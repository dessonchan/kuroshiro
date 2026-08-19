import type { Device } from '../../devices/devices.entity'
import type { CreateLogDto } from '../dto/create-log.dto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogsService } from '../logs.service'

function createMockRepo() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(),
  }
}

describe('logsService firmware payload format', () => {
  let service: LogsService
  let logsRepo: ReturnType<typeof createMockRepo>
  let devicesRepo: ReturnType<typeof createMockRepo>
  const deviceMac = '2d:34:e2:27:5b:46'

  beforeEach(() => {
    logsRepo = createMockRepo()
    devicesRepo = createMockRepo()
    service = new LogsService(
      logsRepo as any,
      devicesRepo as any,
    )
    vi.resetAllMocks()
  })

  it('throws when the device is not found', async () => {
    devicesRepo.findOne.mockResolvedValue(null)
    const dto: CreateLogDto = { logs: [{ id: 1 }] }
    await expect(service.addLogToDevice(deviceMac, dto)).rejects.toThrow()
  })

  it('stores each new log entry using the firmware id field as logId', async () => {
    const device = { id: 'dev', logs: [] } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const dto: CreateLogDto = { logs: [{ id: 7, message: 'hello' }] }

    await service.addLogToDevice(deviceMac, dto)

    expect(logsRepo.save).toHaveBeenCalledTimes(1)
    const saved = logsRepo.save.mock.calls[0][0]
    expect(saved.logId).toBe(7)
    expect(saved.device).toBe(device)
    expect(JSON.parse(saved.entry)).toEqual({ id: 7, message: 'hello' })
  })

  it('does not re-save log entries whose id already exists on the device', async () => {
    const device = { id: 'dev', logs: [{ logId: 1 }, { logId: 2 }] } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const dto: CreateLogDto = { logs: [{ id: 1 }, { id: 2 }] }

    await service.addLogToDevice(deviceMac, dto)

    expect(logsRepo.save).not.toHaveBeenCalled()
  })

  it('saves only the entries that are new, skipping duplicates', async () => {
    const device = { id: 'dev', logs: [{ logId: 1 }] } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const dto: CreateLogDto = { logs: [{ id: 1 }, { id: 2 }, { id: 3 }] }

    await service.addLogToDevice(deviceMac, dto)

    expect(logsRepo.save).toHaveBeenCalledTimes(2)
    const savedIds = logsRepo.save.mock.calls.map(c => c[0].logId)
    expect(savedIds).toEqual([2, 3])
  })
})
