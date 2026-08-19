import type { Plugin } from '../entities/plugin.entity'
import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import type { PluginRendererService } from '../services/plugin-renderer.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginSchedulerService } from '../services/plugin-scheduler.service'

// Capture the cron callback so tests can trigger the scheduled execution.
let capturedCallback: (() => Promise<void>) | null = null
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((_expression, callback) => {
      capturedCallback = callback
      return { start: vi.fn(), stop: vi.fn() }
    }),
  },
}))

describe('pluginSchedulerService per-device rendering', () => {
  let service: PluginSchedulerService
  let mockDataFetcher: PluginDataFetcherService
  let mockRenderer: PluginRendererService
  let mockScreenRepo: any

  beforeEach(() => {
    capturedCallback = null
    mockDataFetcher = { fetchData: vi.fn() } as any
    mockRenderer = { render: vi.fn(), renderForDisplay: vi.fn() } as any
    mockScreenRepo = {
      update: vi.fn(),
      find: vi.fn(),
      manager: { getRepository: vi.fn() },
    }
    service = new PluginSchedulerService(mockDataFetcher, mockRenderer, mockScreenRepo)
    service.mashupSlotRepository = null
  })

  const plugin = {
    id: 'plugin-1',
    name: 'Weather',
    refreshInterval: 15,
    isActive: true,
    dataSource: { url: 'https://api.example.com', method: 'GET' },
    templates: [{ layout: 'full', liquidMarkup: '{{ trmnl.device.name }}' }],
  } as unknown as Plugin

  it('renders once per unique device and shares output across screens on the same device', async () => {
    mockDataFetcher.fetchData.mockResolvedValue({ temp: 20 })
    mockRenderer.render.mockResolvedValue('<html>rendered</html>')
    mockScreenRepo.find.mockResolvedValue([
      { id: 'screen-1', device: { id: 'dev-1' } },
      { id: 'screen-2', device: { id: 'dev-1' } },
      { id: 'screen-3', device: { id: 'dev-2' } },
    ])

    service.schedulePlugin(plugin)
    await capturedCallback!()

    // Two unique devices -> two renders
    expect(mockRenderer.render).toHaveBeenCalledTimes(2)
    // Each screen updated with its own id
    expect(mockScreenRepo.update).toHaveBeenCalledTimes(3)
    expect(mockScreenRepo.update).toHaveBeenCalledWith(
      { id: 'screen-1' },
      expect.objectContaining({ cachedPluginOutput: '<html>rendered</html>' }),
    )
    expect(mockScreenRepo.update).toHaveBeenCalledWith(
      { id: 'screen-2' },
      expect.objectContaining({ cachedPluginOutput: '<html>rendered</html>' }),
    )
    expect(mockScreenRepo.update).toHaveBeenCalledWith(
      { id: 'screen-3' },
      expect.objectContaining({ cachedPluginOutput: '<html>rendered</html>' }),
    )
  })

  it('passes device-specific context to the renderer for each unique device', async () => {
    mockDataFetcher.fetchData.mockResolvedValue({ temp: 20 })
    mockRenderer.render.mockResolvedValue('<html>rendered</html>')
    mockScreenRepo.find.mockResolvedValue([
      { id: 'screen-1', device: { id: 'dev-1', name: 'Kitchen' } },
      { id: 'screen-2', device: { id: 'dev-2', name: 'Bedroom' } },
    ])

    service.schedulePlugin(plugin)
    await capturedCallback!()

    const renderCalls = mockRenderer.render.mock.calls
    expect(renderCalls).toHaveLength(2)
    // Each render receives the device name in the trmnl context
    const names = renderCalls.map(call => call[1].trmnl.device.name)
    expect(names).toContain('Kitchen')
    expect(names).toContain('Bedroom')
  })

  it('handles screens without a device using a shared no-device bucket', async () => {
    mockDataFetcher.fetchData.mockResolvedValue({ temp: 20 })
    mockRenderer.render.mockResolvedValue('<html>rendered</html>')
    mockScreenRepo.find.mockResolvedValue([
      { id: 'screen-1', device: null },
      { id: 'screen-2', device: null },
    ])

    service.schedulePlugin(plugin)
    await capturedCallback!()

    // Both device-less screens share one render
    expect(mockRenderer.render).toHaveBeenCalledTimes(1)
    expect(mockScreenRepo.update).toHaveBeenCalledTimes(2)
  })

  it('fetches data once even when rendering for multiple devices', async () => {
    mockDataFetcher.fetchData.mockResolvedValue({ temp: 20 })
    mockRenderer.render.mockResolvedValue('<html>rendered</html>')
    mockScreenRepo.find.mockResolvedValue([
      { id: 'screen-1', device: { id: 'dev-1' } },
      { id: 'screen-2', device: { id: 'dev-2' } },
    ])

    service.schedulePlugin(plugin)
    await capturedCallback!()

    expect(mockDataFetcher.fetchData).toHaveBeenCalledTimes(1)
  })

  it('does not render or update screens when the plugin has no templates', async () => {
    const noTemplatePlugin = {
      ...plugin,
      templates: [],
    } as unknown as Plugin

    service.schedulePlugin(noTemplatePlugin)
    // No cron callback captured because schedulePlugin returns early
    expect(capturedCallback).toBeNull()
  })
})
