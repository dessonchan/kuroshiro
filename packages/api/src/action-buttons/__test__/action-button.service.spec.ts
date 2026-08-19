import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionButtonService } from '../action-button.service'
import { DisplayScreen } from '../../devices/displayScreen'

function createMockRepo() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

describe('actionButtonService handleAction', () => {
  let service: ActionButtonService
  let actionRepo: ReturnType<typeof createMockRepo>
  let deviceRepo: ReturnType<typeof createMockRepo>
  let screenRepo: ReturnType<typeof createMockRepo>
  let displayService: any
  let configService: any

  beforeEach(() => {
    actionRepo = createMockRepo()
    deviceRepo = createMockRepo()
    screenRepo = createMockRepo()
    displayService = {
      generateScreenImage: vi.fn(),
      screenFilename: vi.fn((s: any) => s.filename ?? 'screen'),
    }
    configService = { get: vi.fn() }
    service = new ActionButtonService(
      actionRepo as any,
      deviceRepo as any,
      screenRepo as any,
      displayService,
      configService,
    )
    vi.resetAllMocks()
  })

  const baseDevice = {
    id: 'dev-1',
    mac: '00:11:22:33:44:55',
    apikey: 'token',
    name: 'Kitchen',
    refreshRate: 60,
    buttons: [],
    actionButtons: [],
  }

  it('throws UnauthorizedException when the device is not found', async () => {
    deviceRepo.findOne.mockResolvedValue(null)
    await expect(service.handleAction('back', 'mac', 'token')).rejects.toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException when the API key is invalid', async () => {
    deviceRepo.findOne.mockResolvedValue({ ...baseDevice, apikey: 'wrong' })
    await expect(service.handleAction('back', 'mac', 'token')).rejects.toThrow(UnauthorizedException)
  })

  it('updates the device buttons when a new X-Buttons header is provided', async () => {
    const device = { ...baseDevice, buttons: ['back'] }
    deviceRepo.findOne.mockResolvedValue(device)
    deviceRepo.save.mockResolvedValue(device)

    await service.handleAction('back', 'mac', 'token', 'back,left,right,confirm')

    expect(device.buttons).toEqual(['back', 'left', 'right', 'confirm'])
    expect(deviceRepo.save).toHaveBeenCalledWith(device)
  })

  it('does not save the device when X-Buttons are unchanged', async () => {
    const device = { ...baseDevice, buttons: ['back', 'left'] }
    deviceRepo.findOne.mockResolvedValue(device)

    await service.handleAction('back', 'mac', 'token', 'back,left')

    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('returns null (204) when no action is configured for the button', async () => {
    const device = { ...baseDevice, actionButtons: [{ button: 'left', actionType: 'webhook' }] }
    deviceRepo.findOne.mockResolvedValue(device)

    const result = await service.handleAction('back', 'mac', 'token')

    expect(result).toBeNull()
  })

  it('activates the target screen and returns its image for a display_screen action', async () => {
    const screen = { id: 'screen-1', filename: 'My Screen', generatedAt: new Date('2026-01-01T00:00:00.000Z') }
    const device = {
      ...baseDevice,
      actionButtons: [{ button: 'confirm', actionType: 'display_screen', screenId: 'screen-1' }],
    }
    deviceRepo.findOne.mockResolvedValue(device)
    screenRepo.findOne.mockResolvedValue(screen)
    screenRepo.update.mockResolvedValue(undefined)
    screenRepo.save.mockResolvedValue(screen)
    displayService.generateScreenImage.mockResolvedValue('http://api/screens/devices/dev-1/screen-1.png')

    const result = await service.handleAction('confirm', 'mac', 'token')

    expect(screen.isActive).toBe(true)
    expect(screenRepo.update).toHaveBeenCalledWith({ device: { id: 'dev-1' } }, { isActive: false })
    expect(screenRepo.save).toHaveBeenCalledWith(screen)
    expect(result).toBeInstanceOf(DisplayScreen)
    expect(result!.image_url).toBe('http://api/screens/devices/dev-1/screen-1.png')
  })

  it('throws NotFoundException for a display_screen action with no screenId', async () => {
    const device = {
      ...baseDevice,
      actionButtons: [{ button: 'confirm', actionType: 'display_screen', screenId: null }],
    }
    deviceRepo.findOne.mockResolvedValue(device)

    await expect(service.handleAction('confirm', 'mac', 'token')).rejects.toThrow(NotFoundException)
  })

  it('throws NotFoundException when the display_screen target screen does not exist', async () => {
    const device = {
      ...baseDevice,
      actionButtons: [{ button: 'confirm', actionType: 'display_screen', screenId: 'missing' }],
    }
    deviceRepo.findOne.mockResolvedValue(device)
    screenRepo.findOne.mockResolvedValue(null)

    await expect(service.handleAction('confirm', 'mac', 'token')).rejects.toThrow(NotFoundException)
  })

  it('fires a POST webhook and returns null (204) for a webhook action', async () => {
    const device = {
      ...baseDevice,
      actionButtons: [{
        button: 'left',
        actionType: 'webhook',
        webhookUrl: 'https://example.com/hook',
        webhookMethod: 'POST',
        webhookPayload: '{"custom":"value"}',
      }],
    }
    deviceRepo.findOne.mockResolvedValue(device)
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch

    const result = await service.handleAction('left', 'mac', 'token')

    expect(result).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://example.com/hook')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.custom).toBe('value')
    expect(body.button).toBe('left')
    expect(body.device_mac).toBe('00:11:22:33:44:55')
  })

  it('fires a GET webhook with query params for a GET webhook action', async () => {
    const device = {
      ...baseDevice,
      actionButtons: [{
        button: 'right',
        actionType: 'webhook',
        webhookUrl: 'https://example.com/hook',
        webhookMethod: 'GET',
        webhookPayload: '{"a":"1"}',
      }],
    }
    deviceRepo.findOne.mockResolvedValue(device)
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch

    await service.handleAction('right', 'mac', 'token')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('GET')
    expect(url).toContain('https://example.com/hook?')
    expect(url).toContain('a=1')
    expect(url).toContain('button=right')
  })

  it('does not throw when a webhook request fails (fire and forget)', async () => {
    const device = {
      ...baseDevice,
      actionButtons: [{
        button: 'left',
        actionType: 'webhook',
        webhookUrl: 'https://example.com/hook',
        webhookMethod: 'POST',
      }],
    }
    deviceRepo.findOne.mockResolvedValue(device)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    await expect(service.handleAction('left', 'mac', 'token')).resolves.toBeNull()
  })
})
