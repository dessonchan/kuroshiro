import type { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { convertToPng } from '../imageUtils'

const mockExec = vi.fn()
const mockFd = {
  read: vi.fn().mockImplementation((buf: any) => {
    buf[0] = 0xFF
    buf[1] = 0xD8
    buf[2] = 0xFF
    return Promise.resolve()
  }),
  close: vi.fn().mockResolvedValue(undefined),
}
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    open: vi.fn(),
  },
}))

vi.mock('node:child_process', () => ({
  exec: (cmd: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    mockExec(cmd, callback)
  },
}))

vi.mock('node:fs', () => ({
  default: mockFs,
  ...mockFs,
}))

describe('imageUtils convertToPng rotation', () => {
  let mockLogger: Logger

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger
    mockFs.promises.open.mockResolvedValue(mockFd)
    mockFd.read.mockImplementation((buf: any) => {
      buf[0] = 0xFF
      buf[1] = 0xD8
      buf[2] = 0xFF
      return Promise.resolve()
    })
    mockFd.close.mockResolvedValue(undefined)
    mockFs.existsSync.mockReturnValue(true)
    mockExec.mockImplementation((cmd: string, callback: any) => callback(null, '', ''))
  })

  it('does not rotate and keeps dimensions when rotation is 0', async () => {
    await convertToPng('/input.jpg', '/output.png', 800, 480, 0, mockLogger)
    const cmd = mockExec.mock.calls[0][0]
    expect(cmd).toContain('-resize 800x480')
    expect(cmd).not.toContain('-rotate')
    expect(cmd).toContain('-extent 800x480')
  })

  it('swaps resize dimensions and adds -rotate 90 for 90-degree rotation', async () => {
    await convertToPng('/input.jpg', '/output.png', 800, 480, 90, mockLogger)
    const cmd = mockExec.mock.calls[0][0]
    // For 90/270 the source is resized to height×width then rotated to native resolution
    expect(cmd).toContain('-resize 480x800')
    expect(cmd).toContain('-rotate 90')
    expect(cmd).toContain('-extent 800x480')
  })

  it('swaps resize dimensions and adds -rotate 270 for 270-degree rotation', async () => {
    await convertToPng('/input.jpg', '/output.png', 800, 480, 270, mockLogger)
    const cmd = mockExec.mock.calls[0][0]
    expect(cmd).toContain('-resize 480x800')
    expect(cmd).toContain('-rotate 270')
    expect(cmd).toContain('-extent 800x480')
  })

  it('keeps dimensions and adds -rotate 180 for 180-degree rotation', async () => {
    await convertToPng('/input.jpg', '/output.png', 800, 480, 180, mockLogger)
    const cmd = mockExec.mock.calls[0][0]
    expect(cmd).toContain('-resize 800x480')
    expect(cmd).toContain('-rotate 180')
    expect(cmd).toContain('-extent 800x480')
  })
})
