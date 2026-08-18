import type { MashupRendererService } from '../mashup/services/mashup-renderer.service'
import type { Plugin } from '../plugins/entities/plugin.entity'
import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto'
import buffer from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import puppeteer from 'puppeteer'
import { Repository } from 'typeorm'
import { PluginDataFetcherService } from '../plugins/services/plugin-data-fetcher.service'
import { PluginRendererService } from '../plugins/services/plugin-renderer.service'
import { PluginTransformService } from '../plugins/services/plugin-transform.service'
import { Screen } from '../screens/screens.entity'
import { fileExists } from '../utils/fileExists'
import { convertToPng, downloadImage } from '../utils/imageUtils'
import { resolveAppPath } from '../utils/pathHelper'
import { buildTrmnlContext } from '../utils/templateContext'
import { isInSchedule, secondsUntilScheduleEnd } from '../utils/schedule'
import { Device } from './devices.entity'
import { Display } from './display'
import { DisplayScreen } from './displayScreen'

interface TrmnlScreenResponse {
  filename: string
  image_url: string
  refresh_rate?: number
  firmware_url?: string
  reset_firmware?: boolean
  special_function?: string
  update_firmware?: boolean
}

@Injectable()
export class DeviceDisplayService {
  private readonly logger = new Logger(DeviceDisplayService.name)
  private mashupRenderer: MashupRendererService

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private screenRepository: Repository<Screen>,
    private configService: ConfigService,
    private pluginDataFetcher: PluginDataFetcherService,
    private pluginRenderer: PluginRendererService,
    private pluginTransformer: PluginTransformService,
  ) {
    // Lazy injection to avoid circular dependency
    setTimeout(async () => {
      try {
        const { MashupRendererService } = await import('../mashup/services/mashup-renderer.service.js')
        // Get it from the module (this is a workaround for circular deps)
        this.mashupRenderer = new MashupRendererService(
          this.pluginDataFetcher,
          this.pluginRenderer,
          this.pluginTransformer,
          this.configService,
        )
      }
      catch {
        this.logger.debug('MashupRendererService not available')
      }
    }, 0)
  }

  async getCurrentImage(headers: DisplayRequestHeadersDto): Promise<Display> {
    this.logger.log(`Display request for MAC: ${headers.id}`)
    this.logger.debug(`Headers: ${JSON.stringify(headers)}`)
    const device = await this.deviceRepository.findOneBy({ mac: headers.id })
    if (!device) {
      this.logger.warn(`Device not found: ${headers.id}`)
      throw new NotFoundException('Device not found')
    }
    if (device.apikey !== headers['access-token']) {
      this.logger.warn(`Invalid API key for device: ${headers.id}`)
      throw new UnauthorizedException('Invalid API key')
    }
    this.logger.log(`Updating device info for MAC: ${headers.id}`)
    device.batteryVoltage = headers['battery-voltage']
    device.fwVersion = headers['fw-version']
    device.rssi = headers.rssi
    device.userAgent = headers['user-agent']
    // Check if height or width has been set already and send error if not initial set
    if (device.width && Number(headers.width) !== device.width)
      throw new BadRequestException('You can\'t change the width anymore')
    if (device.height && Number(headers.height) !== device.height)
      throw new BadRequestException('You can\'t change the height anymore')
    device.height = Number.parseInt(headers.height)
    device.width = Number.parseInt(headers.width)
    // Handling reset
    const resetDevice = device.resetDevice
    device.resetDevice = false
    const updateFirmware = false
    device.lastSeen = new Date()
    // Save X-Buttons header if provided
    if (headers['x-buttons']) {
      const buttons = headers['x-buttons'].split(',').map(b => b.trim()).filter(Boolean)
      device.buttons = buttons
    }
    await this.deviceRepository.save(device)
    this.logger.log(`Device info updated for MAC: ${headers.id}`)

    // === Schedule checks ===
    // 1. Check if device is in off-schedule period (highest priority)
    if (isInSchedule(device.offSchedule, device.timezone)) {
      this.logger.log(`Device ${device.id} is in off-schedule period`)

      // Try to render screen saver if configured
      if (device.screenSaverScreenId) {
        const screenSaver = await this.screenRepository.findOneBy({ id: device.screenSaverScreenId, device: { id: device.id } })
        if (screenSaver) {
          this.logger.log(`Device ${device.id} showing screen saver ${screenSaver.id}`)
          const imgUrl = await this.generateScreenImage(screenSaver, device)
          // Dynamic refresh_rate: min(10x base, seconds until off-schedule ends)
          const secondsToEnd = secondsUntilScheduleEnd(device.offSchedule!, device.timezone)
          const refreshRate = Math.min(device.refreshRate * 10, secondsToEnd)
          return new Display({
            filename: `${this.screenFilename(screenSaver)}_${screenSaver.generatedAt.toISOString()}`,
            firmware_url: '',
            image_url: imgUrl,
            refresh_rate: Math.max(refreshRate, 60), // minimum 60s
            reset_firmware: resetDevice,
            special_function: device.specialFunction,
            update_firmware: updateFirmware,
          })
        }
      }

      // No screen saver — return noScreen.png with slow refresh
      const secondsToEnd = secondsUntilScheduleEnd(device.offSchedule!, device.timezone)
      const refreshRate = Math.min(device.refreshRate * 10, secondsToEnd)
      this.logger.log(`Device ${device.id} in off-schedule with no screen saver, returning noScreen.png`)
      return new Display({
        filename: 'noScreen.png',
        firmware_url: '',
        image_url: `${this.configService.get<string>('api_url')}/screens/noScreen.png`,
        refresh_rate: Math.max(refreshRate, 60),
        reset_firmware: resetDevice,
        special_function: device.specialFunction,
        update_firmware: updateFirmware,
      })
    }

    const activeScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, isActive: true })
    if (!activeScreen && !device.mirrorEnabled) {
      // No active screen — activate the first enabled screen in the playlist
      const screens = await this.screenRepository.find({
        where: { device: { id: device.id } },
        order: { order: 'ASC' },
      })
      const enabledScreen = screens.find(s => this.isScreenEnabled(s, device.timezone))
      if (enabledScreen) {
        enabledScreen.isActive = true
        await this.screenRepository.save(enabledScreen)
        this.logger.log(`No active screen, activated first enabled screen ${enabledScreen.id} for device ${device.id}`)
        return this.getCurrentImage(headers)
      }
      this.logger.log('No screen found returning default no screen image')
      return new Display({
        filename: 'noScreen.png',
        firmware_url: '',
        image_url: `${this.configService.get<string>('api_url')}/screens/noScreen.png`,
        refresh_rate: device.refreshRate,
        reset_firmware: resetDevice,
        special_function: device.specialFunction,
        update_firmware: updateFirmware,
      })
    }
    if (!device.mirrorEnabled) {
      this.logger.log(`Device ${device.id} is not mirrored. Cycling screens.`)
      // Get all screens for this device, ordered by their playlist order
      const screens = await this.screenRepository.find({
        where: { device: { id: device.id } },
        order: { order: 'ASC' },
      })

      // Find the next enabled screen after the current active one
      const currentIndex = screens.findIndex(s => s.id === activeScreen.id)
      let nextScreen: Screen | null = null

      // Search forward from current position, then wrap around
      for (let offset = 1; offset <= screens.length; offset++) {
        const candidate = screens[(currentIndex + offset) % screens.length]
        if (this.isScreenEnabled(candidate, device.timezone)) {
          nextScreen = candidate
          break
        }
      }

      if (!nextScreen) {
        // All screens disabled — return noScreen.png
        this.logger.log(`All screens disabled for device ${device.id}, returning noScreen.png`)
        return new Display({
          filename: 'noScreen.png',
          firmware_url: '',
          image_url: `${this.configService.get<string>('api_url')}/screens/noScreen.png`,
          refresh_rate: device.refreshRate,
          reset_firmware: false,
          special_function: device.specialFunction,
          update_firmware: false,
        })
      }

      await this.screenRepository.update({ device: { id: device.id } }, { isActive: false })
      nextScreen.isActive = true
      await this.screenRepository.save(nextScreen)
      this.logger.log(`Returning screen ${nextScreen.id} for device ${device.id}`)

      const imgUrl = await this.generateScreenImage(nextScreen, device)

      return new Display({
        filename: `${this.screenFilename(nextScreen)}_${nextScreen.generatedAt.toISOString()}`,
        firmware_url: '',
        image_url: imgUrl,
        refresh_rate: device.refreshRate,
        reset_firmware: false,
        special_function: device.specialFunction,
        update_firmware: false,
      })
    }
    else {
      this.logger.log(`Device ${device.id} is mirrored. Fetching from TRMNL.`)
      let proxy = false
      if (device.mac === device.mirrorMac) {
        this.logger.log(`MACs are identical we should proxy the device.`)
        proxy = true
      }
      else {
        this.logger.log(`MACs are different we should mirror with current_screen endpoint.`)
      }
      let refreshRate = device.refreshRate
      let filename = 'error.png'
      let localImageUrl = `${this.configService.get<string>('api_url')}/screens/error.png`
      let firmwareUrl = null
      let resetFirmware = false
      let specialFunction = device.specialFunction
      let updateFirmware = false
      try {
        const { response, localImageUrl: localImage } = await this.fetchAndStoreMirrorImage(device, proxy ? headers : undefined)

        refreshRate = proxy ? response.refresh_rate : refreshRate
        firmwareUrl = proxy ? response.firmware_url : firmwareUrl
        resetFirmware = proxy ? response.reset_firmware : resetFirmware
        specialFunction = proxy ? response.special_function : specialFunction
        updateFirmware = proxy ? response.update_firmware : updateFirmware
        localImageUrl = localImage
        filename = response.filename
      }
      catch (err) {
        this.logger.error(`Failed to process image: ${err.message}`)
      }
      this.logger.log(`Returning mirrored screen for device ${device.id}`)
      return new Display({
        filename,
        firmware_url: firmwareUrl,
        image_url: localImageUrl,
        refresh_rate: refreshRate,
        reset_firmware: resetFirmware,
        special_function: specialFunction,
        update_firmware: updateFirmware,
      })
    }
  }

  /**
   * Check if a screen is currently enabled based on its enableSchedule.
   * null schedule = always enabled.
   * Empty weekdays = schedule disabled (inactive).
   * Otherwise, screen is enabled when current time is WITHIN the schedule.
   */
  private isScreenEnabled(screen: Screen, timezone: string): boolean {
    if (!screen.enableSchedule)
      return true // No schedule = always enabled
    return isInSchedule(screen.enableSchedule, timezone)
  }

  async getCurrentImageWithoutProgressing(headers: Pick<DisplayRequestHeadersDto, 'id' | 'access-token' | 'x-buttons'>): Promise<DisplayScreen> {
    this.logger.log(`Current Screen request for MAC: ${headers.id}`)
    this.logger.debug(`Headers: ${JSON.stringify(headers)}`)
    const device = await this.deviceRepository.findOneBy({ mac: headers.id })
    if (!device) {
      this.logger.warn(`Device not found: ${headers.id}`)
      throw new NotFoundException('Device not found')
    }
    if (device.apikey !== headers['access-token']) {
      this.logger.warn(`Invalid API key for device: ${headers.id}`)
      throw new UnauthorizedException('Invalid API key')
    }
    // Save X-Buttons header if provided
    if (headers['x-buttons']) {
      const buttons = headers['x-buttons'].split(',').map(b => b.trim()).filter(Boolean)
      device.buttons = buttons
      await this.deviceRepository.save(device)
    }
    const activeScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, isActive: true })
    if (!activeScreen && !device.mirrorEnabled) {
      // No active screen — activate the first screen in the playlist
      const firstScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, order: 1 })
      if (firstScreen) {
        firstScreen.isActive = true
        await this.screenRepository.save(firstScreen)
        this.logger.log(`No active screen, activated first screen ${firstScreen.id} for device ${device.id}`)
        return this.getCurrentImageWithoutProgressing(headers)
      }
      this.logger.log('No screen found returning default no screen image')
      return new DisplayScreen({
        filename: 'noScreen.png',
        image_url: `${this.configService.get<string>('api_url')}/screens/noScreen.png`,
        refresh_rate: device.refreshRate,
        rendered_at: new Date(),
      })
    }
    let imgUrl = `${this.configService.get<string>('api_url')}/screens/error.png`
    if (device.mirrorEnabled) {
      this.logger.log(`Mirroring enabled for device ${device.id}, checking for image...`)
      if (await fileExists(resolveAppPath('public', 'screens', 'devices', device.id, 'mirror.png'))) {
        this.logger.log(`Image found returning`)
        imgUrl = `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/mirror.png`
      }
      else {
        this.logger.log(`Mirror image missing on disk, fetching from TRMNL on demand`)
        try {
          const { localImageUrl } = await this.fetchAndStoreMirrorImage(device)
          imgUrl = localImageUrl
        }
        catch (err) {
          this.logger.error(`Failed to fetch mirror image on demand: ${err.message}`)
        }
      }
    }
    else {
      this.logger.log(`Returning screen ${activeScreen.id} for device ${device.id}`)
      // For file/external screens, re-convert from source to ensure correct rotation
      const sourcePath = this.screenSourcePath(device, activeScreen)
      if ((activeScreen.type === 'file' || activeScreen.type === 'external') && await fileExists(sourcePath)) {
        try {
          await convertToPng(sourcePath, this.screenImagePath(device, activeScreen), device.width, device.height, device.rotation, this.logger)
          imgUrl = this.screenImageUrl(device, activeScreen)
        }
        catch (err) {
          this.logger.error(`Failed to re-convert source image: ${err.message}`)
          imgUrl = this.screenImageUrl(device, activeScreen)
        }
      }
      else if (await fileExists(this.screenImagePath(device, activeScreen))) {
        imgUrl = this.screenImageUrl(device, activeScreen)
      }
      else {
        this.logger.log(`Screen image for ${activeScreen.id} missing on disk, generating on demand`)
        imgUrl = await this.generateScreenImage(activeScreen, device)
      }
    }
    return new DisplayScreen({
      filename: device.mirrorEnabled
        ? `mirror_${new Date().toISOString()}`
        : `${this.screenFilename(activeScreen)}_${activeScreen.generatedAt.toISOString()}`,
      image_url: imgUrl,
      refresh_rate: device.refreshRate,
      rendered_at: device.mirrorEnabled ? undefined : activeScreen.generatedAt,
    })
  }

  // ... rest of the methods remain unchanged ...

  private async fetchAndStoreMirrorImage(device: Device, proxyHeaders?: DisplayRequestHeadersDto): Promise<{ response: TrmnlScreenResponse, localImageUrl: string }> {
    const mirrorHeaders = proxyHeaders
      ? { ...proxyHeaders, 'ID': device.mirrorMac, 'access-token': device.mirrorApikey }
      : { 'access-token': device.mirrorApikey, 'ID': device.mirrorMac }
    this.logger.debug(`Sending headers: ${JSON.stringify(mirrorHeaders)}`)
    const res = await fetch(`https://usetrmnl.com/api/${proxyHeaders ? 'display' : 'current_screen'}`, {
      headers: mirrorHeaders,
    })
    const response: TrmnlScreenResponse = await res.json()
    this.logger.debug(`Got this from TRMNL ${JSON.stringify(response)}`)

    const destDir = resolveAppPath('public', 'screens', 'devices', device.id)
    const inputPath = path.join(destDir, response.filename)
    const pngFilename = 'mirror.png'
    const outputPath = path.join(destDir, pngFilename)

    await downloadImage(response.image_url, inputPath, this.logger)
    await convertToPng(inputPath, outputPath, device.width, device.height, device.rotation, this.logger)
    await fs.promises.unlink(inputPath)
    this.logger.log(`Deleted original image: ${inputPath}`)

    return { response, localImageUrl: `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${pngFilename}` }
  }

  async generateScreenImage(screen: Screen, device: Device): Promise<string> {
    let imgUrl: string | null = null

    // Handle mashup screen
    if (screen.type === 'mashup') {
      try {
        const screenWithMashup = await this.screenRepository.findOne({
          where: { id: screen.id },
          relations: {
            mashupConfiguration: {
              slots: {
                plugin: {
                  dataSource: true,
                  templates: true,
                },
              },
            },
          },
        })

        if (screenWithMashup?.mashupConfiguration && this.mashupRenderer) {
          let renderedHtml: string

          // Use cached output if available
          if (screenWithMashup.cachedPluginOutput) {
            this.logger.log(`Using cached mashup output for screen ${screen.id}`)
            renderedHtml = screenWithMashup.cachedPluginOutput
          }
          else {
            this.logger.log(`Rendering mashup ${screenWithMashup.mashupConfiguration.id} for screen ${screen.id}`)
            renderedHtml = await this.mashupRenderer.renderMashup(screenWithMashup.mashupConfiguration, device)
            await this.cachePluginOutput(screen, renderedHtml)
          }

          imgUrl = await this.renderHtmlToScreenPng(renderedHtml, screen, device)
        }
      }
      catch (err) {
        this.logger.error(`Failed to render mashup: ${err.message}`)
        imgUrl = this.errorImageUrl()
      }
    }
    // Handle plugin screen
    else {
      // Load plugin relationship if needed
      const screenWithPlugin = await this.screenRepository.findOne({
        where: { id: screen.id },
        relations: { plugin: { dataSource: true, templates: true } },
      })

      if (screenWithPlugin?.plugin) {
        const plugin = screenWithPlugin.plugin

        // Use cached output if available
        if (screenWithPlugin.cachedPluginOutput) {
          try {
            this.logger.log(`Using cached plugin output for plugin ${plugin.id}, screen ${screen.id}`)
            imgUrl = await this.renderHtmlToScreenPng(screenWithPlugin.cachedPluginOutput, screen, device)
          }
          catch (err) {
            this.logger.error(`Failed to render cached plugin output: ${err.message}`)
            imgUrl = this.errorImageUrl()
          }
        }
        // Fallback: fetch and render on-demand
        else if (plugin.dataSource && plugin.templates && plugin.templates.length > 0) {
          try {
            const renderedHtml = await this.renderPluginHtml(plugin, screen, device)
            if (renderedHtml)
              imgUrl = await this.renderHtmlToScreenPng(renderedHtml, screen, device)
          }
          catch (err) {
            this.logger.error(`Failed to render plugin: ${err.message}`)
            imgUrl = this.errorImageUrl()
          }
        }
      }
      // Handle HTML screen — render LiquidJS templates first
      else if (screen.html) {
        const templateContext = buildTrmnlContext({
          instanceName: 'HTML Screen',
          device,
        })
        const renderedHtml = await this.pluginRenderer.render(screen.html, templateContext)
        imgUrl = await this.renderHtmlToScreenPng(this.wrapInTrmnlShell(renderedHtml), screen, device)
      }
    }
    // Handle external link screen
    if (screen.externalLink && !screen.fetchManual) {
      const inputPath = path.join(resolveAppPath('public', 'screens', 'devices', device.id), `${screen.id}-source`)
      try {
        await downloadImage(screen.externalLink, inputPath, this.logger)
        await convertToPng(inputPath, this.screenImagePath(device, screen), device.width, device.height, device.rotation, this.logger)
        this.logger.log('Updating generation date on screen')
        screen.generatedAt = new Date()
        await this.screenRepository.save(screen)
        this.logger.log('Download and conversion successful')
        imgUrl = this.screenImageUrl(device, screen)
      }
      catch (err) {
        this.logger.error(`Failed to process image: ${err.message}`)
        imgUrl = this.errorImageUrl()
      }
    }
    if (imgUrl !== null)
      return imgUrl

    // For file/external screens without cached output — re-convert from source
    // using the device's current rotation so the image is always correctly oriented
    if (screen.type === 'file' || screen.type === 'external') {
      const sourcePath = this.screenSourcePath(device, screen)
      if (await fileExists(sourcePath)) {
        try {
          await convertToPng(sourcePath, this.screenImagePath(device, screen), device.width, device.height, device.rotation, this.logger)
          return this.screenImageUrl(device, screen)
        }
        catch (err) {
          this.logger.error(`Failed to re-convert source image: ${err.message}`)
        }
      }
    }

    // Fallback: serve existing PNG if source is unavailable
    return await fileExists(this.screenImagePath(device, screen))
      ? this.screenImageUrl(device, screen)
      : this.errorImageUrl()
  }

  private async renderPluginHtml(plugin: Plugin, screen: Screen, device: Device): Promise<string | null> {
    this.logger.log(`No cache, rendering plugin ${plugin.id} on-demand for screen ${screen.id}`)

    // Build template context with trmnl system variables and device data
    const templateContext = buildTrmnlContext({
      instanceName: plugin.name,
      device,
    })

    // TODO: Add plugin field values to context when we have device-specific values

    let data = await this.pluginDataFetcher.fetchData(
      plugin.dataSource.method,
      plugin.dataSource.url,
      plugin.dataSource.headers,
      plugin.dataSource.body,
      templateContext,
    )

    // Apply transform if exists
    if (plugin.dataSource.transformJs) {
      this.logger.debug('Applying transform.js to fetched data')
      data = this.pluginTransformer.transform(plugin.dataSource.transformJs, data)
    }

    const fullTemplate = plugin.templates.find(t => t.layout === 'full')
    if (!fullTemplate)
      return null

    // Merge template context with fetched data so trmnl.* is available in templates
    const templateData: Record<string, any> = { ...templateContext }
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      Object.assign(templateData, data)
    }
    else if (Array.isArray(data)) {
      templateData.data = data
      templateData.items = data
    }
    else {
      templateData.data = data
    }

    const renderedHtml = await this.pluginRenderer.renderForDisplay(fullTemplate.liquidMarkup, templateData)
    await this.cachePluginOutput(screen, renderedHtml)
    return renderedHtml
  }

  private async renderHtmlToScreenPng(html: string, screen: Screen, device: Device): Promise<string> {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-web-security'] })
    try {
      const page = await browser.newPage()
      // Swap viewport dimensions for 90°/270° rotation so content is laid out in portrait
      const isSwapped = device.rotation === 90 || device.rotation === 270
      const viewportWidth = isSwapped ? (device.height || 480) : (device.width || 800)
      const viewportHeight = isSwapped ? (device.width || 800) : (device.height || 480)
      await page.setViewport({ width: viewportWidth, height: viewportHeight })

      // Inject CSS to force the screen container to the swapped dimensions for portrait layout
      let finalHtml = html
      if (isSwapped) {
        const portraitStyles = `<style>
          html, body { margin: 0; padding: 0; width: ${viewportWidth}px; height: ${viewportHeight}px; overflow: hidden; }
          .screen, .mashup { width: ${viewportWidth}px !important; height: ${viewportHeight}px !important; }
          .view, .view--full { width: ${viewportWidth}px !important; height: ${viewportHeight}px !important; }
        </style>`
        finalHtml = html.replace('</head>', `${portraitStyles}</head>`)
        if (!finalHtml.includes(portraitStyles)) {
          // No <head> tag found, prepend styles
          finalHtml = portraitStyles + html
        }
      }

      await page.setContent(finalHtml, { waitUntil: 'load' })
      const image: Uint8Array = await page.screenshot()

      const destDir = resolveAppPath('public', 'screens', 'devices', device.id)
      const inputPath = path.join(destDir, 'tmp-source')
      await fs.promises.mkdir(destDir, { recursive: true })
      await fs.promises.writeFile(inputPath, buffer.Buffer.from(image))
      await convertToPng(inputPath, this.screenImagePath(device, screen), device.width, device.height, device.rotation, this.logger)
      return this.screenImageUrl(device, screen)
    }
    finally {
      await browser.close()
    }
  }

  private wrapInTrmnlShell(html: string): string {
    return `
    <html>
      <head>
        <link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
        <script src="https://usetrmnl.com/js/latest/plugins.js"></script>
      </head>
      <body class="environment trmnl">
        <div class="screen">
          <div class="view view--full">
            ${html}
          </div>
        </div>
      </body>
    </html>
  `
  }

  private async cachePluginOutput(screen: Screen, renderedHtml: string): Promise<void> {
    const generatedAt = new Date()
    await this.screenRepository.update({ id: screen.id }, { cachedPluginOutput: renderedHtml, generatedAt })
    screen.generatedAt = generatedAt
  }

  private screenImagePath(device: Device, screen: Screen): string {
    return resolveAppPath('public', 'screens', 'devices', device.id, `${screen.id}.png`)
  }

  private screenSourcePath(device: Device, screen: Screen): string {
    return resolveAppPath('public', 'screens', 'devices', device.id, `${screen.id}-source`)
  }

  /**
   * Derive a meaningful filename for the screen response.
   * All screens have a filename set during creation (via device settings).
   * Spaces, hyphens, and underscores are converted to camelCase.
   */
  screenFilename(screen: Screen): string {
    const name = screen.filename ?? screen.type
    return name
      .replace(/[-_]/g, ' ')
      .replace(/^\w|[A-Z]|\b\w/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase())
      .replace(/\s+/g, '')
  }

  private screenImageUrl(device: Device, screen: Screen): string {
    return `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${screen.id}.png`
  }

  private errorImageUrl(): string {
    return `${this.configService.get<string>('api_url')}/screens/error.png`
  }
}