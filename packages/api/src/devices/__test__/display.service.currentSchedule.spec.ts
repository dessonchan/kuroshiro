import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DisplayScreen } from '../displayScreen'
import { DeviceDisplayService } from '../display.service'

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
  return { findOneBy: vi.fn(), findOne: vi.fn(), save: vi.fn(), update: vi.fn(), find: vi.fn() }
}

describe('deviceDisplayService current_screen schedule awareness', () => {
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
    width: 800,
    height: 480,
    timezone: 'UTC',
    offSchedule: null,
    screenSaverScreenId: null,
  }

  const headers = { 'id': 'mac', 'access-token': 'token' }

  it('returns noScreen.png when device is in off-schedule and no screensaver is configured', async () => {
    const device = { ...baseDevice, offSchedule: [{ startTime: '00:00', endTime: '23:59', weekdays: [0] }] }
    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')
    isInSchedule.mockReturnValue(true)

    const result = await service.getCurrentImageWithoutProgressing(headers as any)

    expect(result).toBeInstanceOf(DisplayScreen)
    expect(result.filename).toBe('noScreen.png')
    expect(result.image_url).toBe('http://api/screens/noScreen.png')
  })

  it('returns the screensaver image when device is in off-schedule and a screensaver is configured', async () => {
    const device = {
      ...baseDevice,
      offSchedule: [{ startTime: '00:00', endTime: '23:59', weekdays: [0] }],
      screenSaverScreenId: 'saver-1',
    }
    const screenSaver = { id: 'saver-1', filename: 'Saver', generatedAt: new Date('2026-01-01T00:00:00.000Z') }
    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.findOneBy.mockResolvedValue(screenSaver)
    configService.get.mockReturnValue('http://api')
    isInSchedule.mockReturnValue(true)
    vi.spyOn(service as any, 'generateScreenImage').mockResolvedValue('http://api/screens/devices/1/saver-1.png')

    const result = await service.getCurrentImageWithoutProgressing(headers as any)

    expect(result).toBeInstanceOf(DisplayScreen)
    expect(result.filename).toContain('saver')
    expect(result.image_url).toBe('http://api/screens/devices/1/saver-1.png')
  })

  it('cycles to the next enabled screen when the active screen is disabled by its schedule', async () => {
    const device = { ...baseDevice }
    const activeScreen = {
      id: 'screen1', order: 1, isActive: true, enableSchedule: [{ startTime: '09:00', endTime: '17:00', weekdays: [1] }],
      filename: 'Morning', generatedAt: new Date('2026-01-01T00:00:00.000Z'), device,
    }
    const nextScreen = {
      id: 'screen2', order: 2, isActive: false, enableSchedule: null,
      filename: 'Night', generatedAt: new Date('2026-01-02T00:00:00.000Z'), device,
    }
    deviceRepo.findOneBy.mockResolvedValue(device)
    // off-schedule check (device.offSchedule null): not in schedule
    // active screen has an enableSchedule -> isInSchedule returns false (disabled)
    isInSchedule.mockReturnValue(false)
    screenRepo.findOneBy.mockResolvedValue(activeScreen)
    screenRepo.find.mockResolvedValue([activeScreen, nextScreen])
    screenRepo.update.mockResolvedValue(undefined)
    screenRepo.save.mockResolvedValue(nextScreen)
    configService.get.mockReturnValue('http://api')
    vi.spyOn(service as any, 'generateScreenImage').mockResolvedValue('http://api/screens/devices/1/screen2.png')

    const result = await service.getCurrentImageWithoutProgressing(headers as any)

    expect(nextScreen.isActive).toBe(true)
    expect(result).toBeInstanceOf(DisplayScreen)
    expect(result.filename).toBe(`night_${nextScreen.generatedAt.toISOString()}`)
    expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
  })

  it('returns noScreen.png when all screens are disabled by their schedules', async () => {
    const device = { ...baseDevice }
    const activeScreen = {
      id: 's1', order: 1, isActive: true, enableSchedule: [], filename: 'A', generatedAt: new Date(), device,
    }
    const other = {
      id: 's2', order: 2, isActive: false, enableSchedule: [], filename: 'B', generatedAt: new Date(), device,
    }
    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.findOneBy.mockResolvedValue(activeScreen)
    screenRepo.find.mockResolvedValue([activeScreen, other])
    configService.get.mockReturnValue('http://api')
    isInSchedule.mockReturnValue(false) // no screen is enabled

    const result = await service.getCurrentImageWithoutProgressing(headers as any)

    expect(result).toBeInstanceOf(DisplayScreen)
    expect(result.filename).toBe('noScreen.png')
  })

  it('activates the first enabled screen when no active screen exists', async () => {
    const device = { ...baseDevice }
    const firstScreen = {
      id: 's1', order: 1, isActive: false, enableSchedule: null, filename: 'One', generatedAt: new Date(), device,
    }
    deviceRepo.findOneBy.mockResolvedValue(device)
    // First call: no active screen (null) → triggers activation.
    // Recursive call: the activated screen is now found.
    screenRepo.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValue(firstScreen)
    screenRepo.find.mockResolvedValue([firstScreen])
    screenRepo.save.mockResolvedValue(firstScreen)
    configService.get.mockReturnValue('http://api')
    isInSchedule.mockReturnValue(false) // no schedule -> enabled

    const result = await service.getCurrentImageWithoutProgressing(headers as any)

    expect(firstScreen.isActive).toBe(true)
    expect(result).toBeInstanceOf(DisplayScreen)
    expect(result.filename).toContain('one_')
  })
})
