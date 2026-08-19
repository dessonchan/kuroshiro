import * as fs from 'node:fs'
import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreensService } from '../screens.service'

vi.mock('../../utils/imageUtils', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))

function createMockRepo() {
  const repo: any = {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(),
  }
  repo.manager = {
    getRepository: vi.fn(() => repo),
    transaction: vi.fn(async (cb: (manager: any) => Promise<void>) => cb(repo.manager)),
  }
  return repo
}

describe('screensService delete activates first remaining screen', () => {
  let service: ScreensService
  let screensRepo: ReturnType<typeof createMockRepo>
  let devicesRepo: ReturnType<typeof createMockRepo>
  let unlinkMock: any
  const mockConfigService = { get: vi.fn().mockReturnValue(false) }

  beforeEach(() => {
    screensRepo = createMockRepo()
    devicesRepo = createMockRepo()
    service = new ScreensService(
      screensRepo as any,
      devicesRepo as any,
      mockConfigService as any,
    )
    vi.resetAllMocks()
    unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)
  })

  it('throws NotFoundException when the screen does not exist', async () => {
    screensRepo.findOne.mockResolvedValue(null)
    await expect(service.delete('missing')).rejects.toThrow(NotFoundException)
  })

  it('activates the first remaining screen when the deleted screen was active', async () => {
    const deletedScreen = { id: 'screen1', isActive: true, device: { id: 'device1' } }
    const remainingScreens = [
      { id: 'screen2', order: 1, isActive: false },
      { id: 'screen3', order: 2, isActive: false },
    ]

    screensRepo.findOne.mockResolvedValue(deletedScreen)
    screensRepo.find.mockResolvedValue(remainingScreens)
    screensRepo.delete.mockResolvedValue(undefined)
    screensRepo.save.mockResolvedValue(undefined)

    await service.delete('screen1')

    expect(remainingScreens[0].isActive).toBe(true)
    expect(screensRepo.save).toHaveBeenCalledWith(remainingScreens[0])
  })

  it('does not activate any screen when the deleted screen was not active', async () => {
    const deletedScreen = { id: 'screen1', isActive: false, device: { id: 'device1' } }
    const remainingScreens = [
      { id: 'screen2', order: 1, isActive: false },
      { id: 'screen3', order: 2, isActive: false },
    ]

    screensRepo.findOne.mockResolvedValue(deletedScreen)
    screensRepo.find.mockResolvedValue(remainingScreens)
    screensRepo.delete.mockResolvedValue(undefined)
    screensRepo.save.mockResolvedValue(undefined)

    await service.delete('screen1')

    expect(remainingScreens[0].isActive).toBe(false)
    expect(screensRepo.save).not.toHaveBeenCalledWith(remainingScreens[0])
  })

  it('does not activate anything when the deleted screen was active but no screens remain', async () => {
    const deletedScreen = { id: 'screen1', isActive: true, device: { id: 'device1' } }

    screensRepo.findOne.mockResolvedValue(deletedScreen)
    screensRepo.find.mockResolvedValue([])
    screensRepo.delete.mockResolvedValue(undefined)

    await service.delete('screen1')

    expect(screensRepo.save).not.toHaveBeenCalled()
  })
})
