import { promises as fs } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Display } from '../display'
import { DeviceDisplayService } from '../display.service'
import { DisplayScreen } from '../displayScreen'

const { fileExists } = vi.hoisted(() => ({ fileExists: vi.fn() }))
const { isInSchedule, secondsUntilScheduleEnd } = vi.hoisted(() => ({
  isInSchedule: vi.fn(),
  secondsUntilScheduleEnd: vi.fn(),
}))

vi.mock('../../utils/fileExists', () => ({ fileExists }))
vi.mock('../../utils/schedule', () => ({ isInSchedule, secondsUntilScheduleEnd }))
vi.mock('../../utils/templateContext', () => ({
  buildTrmnlContext: vi.fn(() => ({ trmnl: {} })),
}), { virtual: true })
vi.mock('node:fs', () => ({ promises: { unlink: vi.fn() } }))
vi.mock('../../utils/imageUtils', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setViewport: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(new Uint8Array()),
      }),
    }),
  },
}))

function createMockRepo() {
  return {
    findOneBy: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  }
}

describe('deviceDisplayService auto-activate first screen', () => {
  let service: DeviceDisplayService
  let deviceRepo: ReturnType<typeof createMockRepo>
  let screenRepo: ReturnType<typeof createMockRepo>
  let configService: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    deviceRepo = createMockRepo()
    screenRepo = createMockRepo()
    configService = { get: vi.fn() }
    service = new DeviceDisplayService(
      deviceRepo as any,
      screenRepo as any,
      configService as any,
    )
    vi.resetAllMocks()
    isInSchedule.mockReturnValue(false)
    secondsUntilScheduleEnd.mockReturnValue(3600)
    screenRepo.find.mockResolvedValue([])
  })

  const baseDevice = {
    id: '1',
    mac: 'mac',
    apikey: 'token',
    refreshRate: 60,
    resetDevice: false,
    updateFirmware: false,
    specialFunction: 'identify',
    mirrorEnabled: false,
    width: undefined,
    height: undefined,
  }

  const headers = { 'id': 'mac', 'access-token': 'token' }

  it('activates the first screen when no screen is active (getCurrentImage)', async () => {
    const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
    const firstScreen = { id: 'screen1', order: 1, isActive: false, device, filename: 'first.png', generatedAt: new Date() }

    deviceRepo.findOneBy.mockResolvedValue(device)
    // First call: active-screen lookup -> null (triggers activation).
    // Second call (recursion): the activated screen is now found.
    screenRepo.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValue(firstScreen)
    screenRepo.find.mockResolvedValue([firstScreen])
    screenRepo.save.mockResolvedValue(firstScreen)
    configService.get.mockReturnValue('http://api')
    deviceRepo.save.mockResolvedValue(undefined)
    fileExists.mockResolvedValue(true)

    const result = await service.getCurrentImage(headers as any)

    expect(firstScreen.isActive).toBe(true)
    expect(screenRepo.save).toHaveBeenCalledWith(firstScreen)
    expect(result).toBeInstanceOf(Display)
  })

  it('returns the default no-screen image when there is no active screen and no screens in the playlist', async () => {
    const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }

    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.findOneBy.mockResolvedValue(null)
    screenRepo.find.mockResolvedValue([])
    configService.get.mockReturnValue('http://api')
    deviceRepo.save.mockResolvedValue(undefined)

    const result = await service.getCurrentImage(headers as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('noScreen.png')
  })

  it('activates the first screen when no screen is active (getCurrentImageWithoutProgressing)', async () => {
    const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
    const firstScreen = { id: 'screen1', order: 1, isActive: false, device, filename: 'first.png', generatedAt: new Date() }

    deviceRepo.findOneBy.mockResolvedValue(device)
    // First call: active-screen lookup returns null. Second call (recursive): firstScreen is active.
    screenRepo.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValue(firstScreen)
    screenRepo.find.mockResolvedValue([firstScreen])
    screenRepo.save.mockResolvedValue(firstScreen)
    configService.get.mockReturnValue('http://api')
    fileExists.mockResolvedValue(true)

    const result = await service.getCurrentImageWithoutProgressing(headers as any)

    expect(firstScreen.isActive).toBe(true)
    expect(screenRepo.save).toHaveBeenCalledWith(firstScreen)
    expect(result).toBeInstanceOf(DisplayScreen)
  })
})
