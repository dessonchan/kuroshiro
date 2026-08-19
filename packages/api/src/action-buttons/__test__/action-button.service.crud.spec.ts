import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionButtonService } from '../action-button.service'

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

describe('actionButtonService CRUD', () => {
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
    displayService = { generateScreenImage: vi.fn(), screenFilename: vi.fn() }
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

  it('returns the action buttons for a device', async () => {
    const buttons = [{ id: 'ab-1', button: 'back' }]
    actionRepo.find.mockResolvedValue(buttons)
    const result = await service.getActionButtonsForDevice('dev-1')
    expect(actionRepo.find).toHaveBeenCalledWith({ where: { device: { id: 'dev-1' } } })
    expect(result).toBe(buttons)
  })

  it('creates an action button for an existing device', async () => {
    const device = { id: 'dev-1' }
    const created = { id: 'ab-1', button: 'confirm', actionType: 'display_screen', device }
    deviceRepo.findOneBy.mockResolvedValue(device)
    actionRepo.create.mockReturnValue(created)
    actionRepo.save.mockResolvedValue(created)

    const result = await service.createActionButton('dev-1', {
      button: 'confirm',
      actionType: 'display_screen',
    })

    expect(actionRepo.create).toHaveBeenCalledWith({
      button: 'confirm',
      actionType: 'display_screen',
      screenId: undefined,
      webhookUrl: undefined,
      webhookMethod: undefined,
      webhookPayload: undefined,
      device,
    })
    expect(actionRepo.save).toHaveBeenCalledWith(created)
    expect(result).toBe(created)
  })

  it('throws NotFoundException when creating an action button for a missing device', async () => {
    deviceRepo.findOneBy.mockResolvedValue(null)
    await expect(service.createActionButton('missing', { button: 'back', actionType: 'webhook' }))
      .rejects.toThrow(NotFoundException)
  })

  it('updates an existing action button', async () => {
    const existing = { id: 'ab-1', button: 'back', actionType: 'webhook' }
    actionRepo.findOne.mockResolvedValue(existing)
    actionRepo.save.mockResolvedValue({ ...existing, webhookUrl: 'https://new.example.com' })

    const result = await service.updateActionButton('ab-1', { webhookUrl: 'https://new.example.com' })

    expect(existing.webhookUrl).toBe('https://new.example.com')
    expect(actionRepo.save).toHaveBeenCalledWith(existing)
    expect(result.webhookUrl).toBe('https://new.example.com')
  })

  it('throws NotFoundException when updating a missing action button', async () => {
    actionRepo.findOne.mockResolvedValue(null)
    await expect(service.updateActionButton('missing', { webhookUrl: 'x' }))
      .rejects.toThrow(NotFoundException)
  })

  it('deletes an existing action button', async () => {
    actionRepo.delete.mockResolvedValue({ affected: 1 })
    await expect(service.deleteActionButton('ab-1')).resolves.toBeUndefined()
    expect(actionRepo.delete).toHaveBeenCalledWith('ab-1')
  })

  it('throws NotFoundException when deleting a missing action button', async () => {
    actionRepo.delete.mockResolvedValue({ affected: 0 })
    await expect(service.deleteActionButton('missing')).rejects.toThrow(NotFoundException)
  })
})
