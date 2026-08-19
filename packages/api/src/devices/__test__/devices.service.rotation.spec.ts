import type { Repository } from 'typeorm'
import type { Device } from '../devices.entity'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevicesService } from '../devices.service'

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

vi.mock('node:fs', () => mockFs)
vi.mock('../../utils/pathHelper', () => ({
  resolveAppPath: vi.fn(() => '/screens/devices/1'),
}))

function createMockRepository() {
  return {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  }
}

describe('devicesService rotation cache invalidation', () => {
  let service: DevicesService
  let deviceRepo: ReturnType<typeof createMockRepository>
  let screenRepo: ReturnType<typeof createMockRepository>

  beforeEach(() => {
    deviceRepo = createMockRepository()
    screenRepo = createMockRepository()
    service = new DevicesService(
      deviceRepo as unknown as Repository<Device>,
      screenRepo as unknown as Repository<any>,
    )
    vi.resetAllMocks()
  })

  const makeDevice = (overrides: Partial<Device> = {}) => ({
    id: '1',
    friendlyId: 'abc',
    mac: '00:11:22:33:44:55',
    apikey: 'key',
    refreshRate: 60,
    resetDevice: false,
    updateFirmware: false,
    rotation: 0,
    screens: [],
    ...overrides,
  } as unknown as Device)

  it('clears cached plugin output and deletes PNGs when rotation changes', async () => {
    deviceRepo.findOneBy.mockResolvedValue(makeDevice())
    deviceRepo.save.mockResolvedValue(makeDevice({ rotation: 90 }))
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readdirSync.mockReturnValue(['screen1.png', 'screen2.png', 'notes.txt'])

    await service.update('1', { rotation: 90 })

    // Cached plugin output cleared for all screens of the device
    expect(screenRepo.update).toHaveBeenCalledWith(
      { device: { id: '1' } },
      { cachedPluginOutput: null },
    )
    // Only PNG files deleted, non-PNG left alone
    expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2)
    expect(mockFs.unlinkSync).toHaveBeenCalledWith('/screens/devices/1/screen1.png')
    expect(mockFs.unlinkSync).toHaveBeenCalledWith('/screens/devices/1/screen2.png')
  })

  it('does not clear cache when rotation is unchanged', async () => {
    deviceRepo.findOneBy.mockResolvedValue(makeDevice())
    deviceRepo.save.mockResolvedValue(makeDevice())

    await service.update('1', { rotation: 0 })

    expect(screenRepo.update).not.toHaveBeenCalled()
    expect(mockFs.unlinkSync).not.toHaveBeenCalled()
  })

  it('does not clear cache when rotation is not provided in the update', async () => {
    deviceRepo.findOneBy.mockResolvedValue(makeDevice())
    deviceRepo.save.mockResolvedValue(makeDevice())

    await service.update('1', { refreshRate: 30 })

    expect(screenRepo.update).not.toHaveBeenCalled()
    expect(mockFs.unlinkSync).not.toHaveBeenCalled()
  })

  it('handles a missing device directory gracefully', async () => {
    deviceRepo.findOneBy.mockResolvedValue(makeDevice())
    deviceRepo.save.mockResolvedValue(makeDevice({ rotation: 180 }))
    mockFs.existsSync.mockReturnValue(false)

    await service.update('1', { rotation: 180 })

    expect(screenRepo.update).toHaveBeenCalled()
    expect(mockFs.readdirSync).not.toHaveBeenCalled()
  })
})
