import type { ScheduledTask } from 'node-cron'
import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity'
import type { Plugin } from '../entities/plugin.entity'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { Repository } from 'typeorm'
import { Screen } from '../../screens/screens.entity'
import { PluginDataFetcherService } from './plugin-data-fetcher.service'
import { PluginRendererService } from './plugin-renderer.service'
import { buildTrmnlContext } from '../../utils/templateContext'
import { Device } from '../../devices/devices.entity'

@Injectable()
export class PluginSchedulerService {
  private scheduledJobs: Map<string, ScheduledTask> = new Map()
  private mashupSlotRepository: Repository<MashupSlot>
  private readonly logger = new Logger(PluginSchedulerService.name)

  constructor(
    private readonly dataFetcher: PluginDataFetcherService,
    private readonly renderer: PluginRendererService,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
  ) {
    // Lazy injection to avoid circular dependency
    setTimeout(() => {
      try {
        this.mashupSlotRepository = this.screenRepository.manager.getRepository('MashupSlot')
      }
      catch {
        this.logger.debug('MashupSlot repository not available')
      }
    }, 0)
  }

  schedulePlugin(plugin: Plugin): void {
    if (!plugin.dataSource || !plugin.templates || plugin.templates.length === 0) {
      return
    }

    const cronExpression = this.getCronExpression(plugin.refreshInterval)

    const task = cron.schedule(cronExpression, async () => {
      try {
        // Build base template context (no device — shared across all renders)
        const baseContext = buildTrmnlContext({
          instanceName: plugin.name,
        })

        // TODO: Add plugin field values to context when we have device-specific values

        // Fetch data once — same API call for all devices
        const data = await this.dataFetcher.fetchData(
          plugin.dataSource!.method,
          plugin.dataSource!.url,
          plugin.dataSource!.headers,
          plugin.dataSource!.body,
          baseContext,
        )

        if (plugin.templates.length === 0)
          return

        // Find all screens for this plugin with their devices
        const screens = await this.screenRepository.find({
          where: { plugin: { id: plugin.id } },
          relations: { device: true },
        })

        // Render per unique device — multiple screens on the same device share output
        const deviceRenderCache = new Map<string, string>()

        for (const screen of screens) {
          const device = screen.device as Device | undefined
          const deviceId = device?.id ?? '__no_device__'

          let rendered: string
          if (deviceRenderCache.has(deviceId)) {
            rendered = deviceRenderCache.get(deviceId)!
          }
          else {
            // Build device-specific template context
            const templateContext = buildTrmnlContext({
              instanceName: plugin.name,
              device,
            })

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

            rendered = await this.renderer.render(plugin.templates[0].liquidMarkup, templateData)
            deviceRenderCache.set(deviceId, rendered)
          }

          // Update this specific screen's cache
          await this.screenRepository.update(
            { id: screen.id },
            {
              cachedPluginOutput: rendered,
              generatedAt: new Date(),
            },
          )
        }

        // Invalidate mashup caches that use this plugin
        await this.invalidateMashupCaches(plugin.id)
      }
      catch (error) {
        console.error(`Error executing plugin ${plugin.id}:`, error)
      }
    })

    this.scheduledJobs.set(plugin.id, task)
  }

  async invalidateMashupCaches(pluginId: string): Promise<void> {
    if (!this.mashupSlotRepository) {
      return
    }

    try {
      const mashupsWithPlugin = await this.mashupSlotRepository.find({
        where: { plugin: { id: pluginId } },
        relations: { mashupConfiguration: { screen: true } },
      })

      for (const slot of mashupsWithPlugin) {
        await this.screenRepository.update(
          { id: slot.mashupConfiguration.screen.id },
          { cachedPluginOutput: null },
        )
      }

      if (mashupsWithPlugin.length > 0) {
        this.logger.log(`Invalidated ${mashupsWithPlugin.length} mashup cache(s) for plugin ${pluginId}`)
      }
    }
    catch (error) {
      this.logger.error(`Failed to invalidate mashup caches for plugin ${pluginId}: ${error.message}`)
    }
  }

  removeScheduledJob(pluginId: string): void {
    const task = this.scheduledJobs.get(pluginId)
    if (task) {
      task.stop()
      this.scheduledJobs.delete(pluginId)
    }
  }

  hasScheduledJob(pluginId: string): boolean {
    return this.scheduledJobs.has(pluginId)
  }

  private getCronExpression(minutes: number): string {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      return hours === 1 ? '0 * * * *' : `0 */${hours} * * *`
    }
    return `*/${minutes} * * * *`
  }
}