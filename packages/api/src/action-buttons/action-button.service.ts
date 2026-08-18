import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { DeviceDisplayService } from '../devices/display.service'
import { DisplayScreen } from '../devices/displayScreen'
import { Screen } from '../screens/screens.entity'
import { isInSchedule } from '../utils/schedule'
import { ActionButton } from './action-button.entity'
import { CreateActionButtonDto } from './dto/create-action-button.dto'
import { UpdateActionButtonDto } from './dto/update-action-button.dto'

@Injectable()
export class ActionButtonService {
  private readonly logger = new Logger(ActionButtonService.name)

  constructor(
    @InjectRepository(ActionButton)
    private readonly actionButtonRepository: Repository<ActionButton>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    private readonly displayService: DeviceDisplayService,
    private readonly configService: ConfigService,
  ) {}

  async getActionButtonsForDevice(deviceId: string): Promise<ActionButton[]> {
    return this.actionButtonRepository.find({ where: { device: { id: deviceId } } })
  }

  async createActionButton(deviceId: string, dto: CreateActionButtonDto): Promise<ActionButton> {
    const device = await this.deviceRepository.findOneBy({ id: deviceId })
    if (!device)
      throw new NotFoundException('Device not found')

    const actionButton = this.actionButtonRepository.create({
      button: dto.button,
      actionType: dto.actionType,
      screenId: dto.screenId,
      webhookUrl: dto.webhookUrl,
      webhookMethod: dto.webhookMethod,
      webhookPayload: dto.webhookPayload,
      device,
    })
    return this.actionButtonRepository.save(actionButton)
  }

  async updateActionButton(id: string, dto: UpdateActionButtonDto): Promise<ActionButton> {
    const actionButton = await this.actionButtonRepository.findOne({ where: { id }, relations: { device: true } })
    if (!actionButton)
      throw new NotFoundException('Action button not found')

    Object.assign(actionButton, dto)
    return this.actionButtonRepository.save(actionButton)
  }

  async deleteActionButton(id: string): Promise<void> {
    const result = await this.actionButtonRepository.delete(id)
    if (!result.affected)
      throw new NotFoundException('Action button not found')
  }

  /**
   * Handle a button press from a device.
   * Authenticates the device, finds the action config for that button,
   * and executes the action (display a screen or fire a webhook).
   *
   * NOTE: Action buttons RESPECT device off-schedule (no display during off time)
   * but IGNORE screen enable-schedule (manual press forces display).
   */
  async handleAction(button: string, mac: string, apikey: string, xButtons?: string): Promise<DisplayScreen | null> {
    // Authenticate device
    const device = await this.deviceRepository.findOne({ where: { mac }, relations: { actionButtons: true } })
    if (!device)
      throw new UnauthorizedException('Device not found')
    if (device.apikey !== apikey)
      throw new UnauthorizedException('Invalid API key')

    // Update X-Buttons if provided
    if (xButtons) {
      const buttons = xButtons.split(',').map(b => b.trim()).filter(Boolean)
      if (JSON.stringify(device.buttons) !== JSON.stringify(buttons)) {
        device.buttons = buttons
        await this.deviceRepository.save(device)
      }
    }

    // Respect device off-schedule: no action during sleep time
    if (isInSchedule(device.offSchedule, device.timezone)) {
      this.logger.log(`Device ${device.id} is in off-schedule, ignoring button "${button}"`)
      return null
    }

    // Find the action config for this button
    const actionConfig = device.actionButtons.find(ab => ab.button === button)
    if (!actionConfig) {
      this.logger.log(`No action configured for button "${button}" on device ${device.id}`)
      return null // 204 No Content
    }

    // Execute the action
    if (actionConfig.actionType === 'display_screen') {
      return this.displayScreen(actionConfig.screenId, device)
    }
    else if (actionConfig.actionType === 'webhook') {
      await this.fireWebhook(actionConfig, device, button)
      return null // 204 No Content — fire and forget
    }

    return null
  }

  private async displayScreen(screenId: string | null | undefined, device: Device): Promise<DisplayScreen> {
    if (!screenId) {
      this.logger.warn(`No screen ID configured for display_screen action on device ${device.id}`)
      throw new NotFoundException('No screen configured for this action')
    }

    const screen = await this.screenRepository.findOne({ where: { id: screenId, device: { id: device.id } } })
    if (!screen)
      throw new NotFoundException('Screen not found')

    // Activate the screen and generate its image
    screen.isActive = true
    // Deactivate all other screens for this device
    await this.screenRepository.update({ device: { id: device.id } }, { isActive: false })
    await this.screenRepository.save(screen)

    const imgUrl = await this.displayService.generateScreenImage(screen, device)
    return new DisplayScreen({
      filename: `${this.displayService.screenFilename(screen)}_${screen.generatedAt.toISOString()}`,
      image_url: imgUrl,
      refresh_rate: device.refreshRate,
      rendered_at: screen.generatedAt,
    })
  }

  private async fireWebhook(actionConfig: ActionButton, device: Device, button: string): Promise<void> {
    const url = actionConfig.webhookUrl
    if (!url) {
      this.logger.warn(`No webhook URL configured for button "${button}" on device ${device.id}`)
      return
    }

    const method = (actionConfig.webhookMethod || 'POST').toLowerCase() as 'get' | 'post' | 'put'
    let payload = actionConfig.webhookPayload
      ? JSON.parse(actionConfig.webhookPayload)
      : {}

    // Add device context to the payload
    payload = {
      ...payload,
      button,
      device_mac: device.mac,
      device_id: device.id,
      device_name: device.name,
      timestamp: new Date().toISOString(),
    }

    try {
      if (method === 'get') {
        const params = new URLSearchParams(payload).toString()
        await fetch(`${url}${url.includes('?') ? '&' : '?'}${params}`, { method: 'GET', signal: AbortSignal.timeout(5000) })
      }
      else {
        await fetch(url, { method: method.toUpperCase(), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) })
      }
      this.logger.log(`Webhook fired for button "${button}" on device ${device.id}: ${method.toUpperCase()} ${url}`)
    }
    catch (err: any) {
      this.logger.error(`Webhook failed for button "${button}" on device ${device.id}: ${err.message}`)
    }
  }
}
