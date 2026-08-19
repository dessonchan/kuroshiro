import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Display } from '../display'
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

describe('deviceDisplayService off-schedule and screensaver', () => {
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
    timezone: 'UTC',
    offSchedule: null,
    screenSaverScreenId: null,
  }

  const headers = { 'id': 'mac', 'access-token': 'token' }

  it('returns noScreen.png with a slow refresh when the device is in off-schedule and has no screensaver', async () => {
    const device = { ...baseDevice, offSchedule: [{ startTime: '00:00', endTime: '23:59', weekdays: [0] }] }
    deviceRepo.findOneBy.mockResolvedValue(device)
    deviceRepo.save.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')
    isInSchedule.mockReturnValue(true)
    secondsUntilScheduleEnd.mockReturnValue(3600)

    const result = await service.getCurrentImage(headers as any)

    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('noScreen.png')
    expect(result.image_url).toBe('http://api/screens/noScreen.png')
    // refresh_rate = min(60*10, 3600) = 600, clamped to min 60
    expect(result.refresh_rate).toBe(600)
  })

  it('renders the screensaver screen when in off-schedule and a screensaver is configured', async () => {
    const device = {
      ...baseDevice,
      offSchedule: [{ startTime: '00:00', endTime: '23:59', weekdays: [0] }],
      screenSaverScreenId: 'saver-1',
    }
    const screenSaver = { id: 'saver-1', filename: 'Saver', generatedAt: new Date('2026-01-01T00:00:00.000Z') }
    deviceRepo.findOneBy.mockResolvedValue(device)
    deviceRepo.save.mockResolvedValue(device)
    screenRepo.findOneBy.mockResolvedValue(screenSaver)
    configService.get.mockReturnValue('http://api')
    isInSchedule.mockReturnValue(true)
    secondsUntilScheduleEnd.mockReturnValue(3600)
    vi.spyOn(service as any, 'generateScreenImage').mockResolvedValue('http://api/screens/devices/1/saver-1.png')

    const result = await service.getCurrentImage(headers as any)

    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toContain('saver')
    expect(result.image_url).toBe('http://api/screens/devices/1/saver-1.png')
  })

  it('does not apply off-schedule when the device is not in schedule', async () => {
    const device = { ...baseDevice, offSchedule: [{ startTime: '00:00', endTime: '23:59', weekdays: [0] }] }
    deviceRepo.findOneBy.mockResolvedValue(device)
    deviceRepo.save.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')
    isInSchedule.mockReturnValue(false)
    // No active screen and no screens in the playlist -> default noScreen
    screenRepo.findOneBy.mockResolvedValue(null)
    screenRepo.find.mockResolvedValue([])

    const result = await service.getCurrentImage(headers as any)

    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('noScreen.png')
  })
})
