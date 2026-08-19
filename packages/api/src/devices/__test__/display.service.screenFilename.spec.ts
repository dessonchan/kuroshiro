import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceDisplayService } from '../display.service'

const { fileExists } = vi.hoisted(() => ({ fileExists: vi.fn() }))
vi.mock('../../utils/fileExists', () => ({ fileExists }))
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
  return { findOneBy: vi.fn(), findOne: vi.fn(), save: vi.fn(), update: vi.fn() }
}

describe('deviceDisplayService screenFilename', () => {
  let service: DeviceDisplayService

  beforeEach(() => {
    service = new DeviceDisplayService(
      createMockRepo() as any,
      createMockRepo() as any,
      { get: vi.fn() } as any,
    )
  })

  it('converts a simple filename to camelCase', () => {
    const result = (service as any).screenFilename({ filename: 'My Screen' })
    expect(result).toBe('myScreen')
  })

  it('converts hyphens and underscores to camelCase', () => {
    expect((service as any).screenFilename({ filename: 'my-screen' })).toBe('myScreen')
    expect((service as any).screenFilename({ filename: 'my_screen' })).toBe('myScreen')
  })

  it('keeps the .png extension lowercase (not uppercased)', () => {
    const result = (service as any).screenFilename({ filename: 'my screen.png' })
    expect(result).toBe('myScreen.png')
  })

  it('falls back to the screen type when filename is missing', () => {
    expect((service as any).screenFilename({ filename: null, type: 'plugin' })).toBe('plugin')
  })

  it('handles a single-word filename', () => {
    expect((service as any).screenFilename({ filename: 'Weather' })).toBe('weather')
  })

  it('handles an already-camelCase filename', () => {
    expect((service as any).screenFilename({ filename: 'myScreen' })).toBe('myScreen')
  })
})
