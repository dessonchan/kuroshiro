import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Display } from '../display'
import { DisplayScreen } from '../displayScreen'
import { DeviceDisplayService } from '../display.service'

const { fileExists } = vi.hoisted(() => ({ fileExists: vi.fn() }))
const { isInSchedule, secondsUntilScheduleEnd } = vi.hoisted(() => ({
  isInSchedule: vi.fn(),
  secondsUntilScheduleEnd: vi.fn(),
}))
const { writeFileMock, readFileMock, mkdirMock } = vi.hoisted(() => ({
  writeFileMock: vi.fn(),
  readFileMock: vi.fn(),
  mkdirMock: vi.fn(),
}))

vi.mock('../../utils/fileExists', () => ({ fileExists }))
vi.mock('../../utils/schedule', () => ({ isInSchedule, secondsUntilScheduleEnd }))
vi.mock('../../utils/templateContext', () => ({
  buildTrmnlContext: vi.fn(() => ({ trmnl: {} })),
}), { virtual: true })
vi.mock('node:fs', () => ({
  promises: {
    unlink: vi.fn(),
    writeFile: writeFileMock,
    readFile: readFileMock,
    mkdir: mkdirMock,
  },
}))
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

describe('deviceDisplayService current screen file cache', () => {
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
    writeFileMock.mockResolvedValue(undefined)
    mkdirMock.mockResolvedValue(undefined)
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

  const headers = { 'id': 'mac', 'access-token': 'token', width: '800', height: '480' }

  it('writes a cache file when /api/display returns a screen', async () => {
    const device = { ...baseDevice }
    const activeScreen = { id: 's1', order: 1, isActive: true, enableSchedule: null, filename: 'Screen', generatedAt: new Date(), device }
    deviceRepo.findOneBy.mockResolvedValue(device)
    deviceRepo.save.mockResolvedValue(device)
    screenRepo.findOneBy.mockResolvedValue(activeScreen)
    screenRepo.find.mockResolvedValue([activeScreen])
    screenRepo.update.mockResolvedValue(undefined)
    screenRepo.save.mockResolvedValue(activeScreen)
    configService.get.mockReturnValue('http://api')
    fileExists.mockResolvedValue(true)
    vi.spyOn(service as any, 'generateScreenImage').mockResolvedValue('http://api/screens/devices/1/s1.png')

    await service.getCurrentImage(headers as any)

    expect(writeFileMock).toHaveBeenCalled()
    const [cachePath, payload] = writeFileMock.mock.calls[0]
    expect(cachePath).toContain('current-screen.json')
    const data = JSON.parse(payload)
    expect(data.filename).toBeDefined()
    expect(data.image_url).toBeDefined()
  })

  it('returns the cached screen on /api/current_screen without recomputing', async () => {
    const device = { ...baseDevice }
    const cachedScreen = new DisplayScreen({
      filename: 'cached.png',
      image_url: 'http://api/screens/devices/1/cached.png',
      refresh_rate: 60,
      rendered_at: new Date('2026-01-01T00:00:00.000Z'),
    })
    deviceRepo.findOneBy.mockResolvedValue(device)
    readFileMock.mockResolvedValue(JSON.stringify(cachedScreen))

    const result = await service.getCurrentImageWithoutProgressing(headers as any)

    expect(result.filename).toBe('cached.png')
    expect(result.image_url).toBe('http://api/screens/devices/1/cached.png')
    // It should NOT query screens (no recompute)
    expect(screenRepo.findOneBy).not.toHaveBeenCalled()
  })

  it('falls back to live computation when no cache exists', async () => {
    const device = { ...baseDevice }
    const activeScreen = { id: 's1', order: 1, isActive: true, enableSchedule: null, filename: 'Screen', generatedAt: new Date(), device }
    deviceRepo.findOneBy.mockResolvedValue(device)
    // No cache file → readFile rejects
    readFileMock.mockRejectedValue(new Error('ENOENT'))
    screenRepo.findOneBy.mockResolvedValue(activeScreen)
    screenRepo.find.mockResolvedValue([activeScreen])
    configService.get.mockReturnValue('http://api')
    fileExists.mockResolvedValue(true)

    const result = await service.getCurrentImageWithoutProgressing(headers as any)

    expect(result).toBeInstanceOf(DisplayScreen)
    // screenFilename camelCases 'Screen' → 'screen'
    expect(result.filename).toContain('screen_')
  })
})
