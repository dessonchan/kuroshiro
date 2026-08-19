import type { Plugin } from '@/types/plugin'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import PluginCard from '../PluginCard.vue'

globalThis.ResizeObserver = rop

globalThis.window.matchMedia = globalThis.window.matchMedia || function () {
  return {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
}

Object.defineProperty(globalThis, 'visualViewport', {
  value: {
    width: 1024,
    height: 768,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  writable: true,
})

let pluginsStoreMock: any
vi.mock('@/stores/plugins', () => ({
  usePluginsStore: () => pluginsStoreMock,
}))

const mockRouter = {
  push: vi.fn(),
}
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}))

vi.mock('../PluginAssignDialog.vue', () => ({
  default: {
    name: 'PluginAssignDialog',
    template: '<div></div>',
  },
}))

describe('pluginCard unassign feature', () => {
  beforeEach(() => {
    pluginsStoreMock = {
      unassignFromDevice: vi.fn(),
    }
    mockRouter.push.mockClear()
  })

  const basePlugin: Plugin = {
    id: 'plugin-1',
    name: 'Test Plugin',
    description: 'Test Description',
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('shows the Unassign button only when a deviceId is provided', () => {
    const withDevice = mount(PluginCard, {
      props: { plugin: basePlugin, deviceId: 'device-1' },
      global: { plugins: [createPinia(), vuetify] },
    })
    expect(withDevice.text()).toContain('Unassign')

    const withoutDevice = mount(PluginCard, {
      props: { plugin: basePlugin },
      global: { plugins: [createPinia(), vuetify] },
    })
    expect(withoutDevice.text()).not.toContain('Unassign')
  })

  it('calls unassignFromDevice with the plugin id and device id on click', async () => {
    pluginsStoreMock.unassignFromDevice.mockResolvedValue(undefined)
    const wrapper = mount(PluginCard, {
      props: { plugin: basePlugin, deviceId: 'device-1' },
      global: { plugins: [createPinia(), vuetify] },
    })

    const unassignBtn = wrapper.findAll('button').find(btn => btn.text().includes('Unassign'))
    expect(unassignBtn).toBeTruthy()
    await unassignBtn!.trigger('click')
    await flushPromises()

    expect(pluginsStoreMock.unassignFromDevice).toHaveBeenCalledWith('plugin-1', 'device-1')
  })

  it('emits assignmentsChanged after a successful unassign', async () => {
    pluginsStoreMock.unassignFromDevice.mockResolvedValue(undefined)
    const wrapper = mount(PluginCard, {
      props: { plugin: basePlugin, deviceId: 'device-1' },
      global: { plugins: [createPinia(), vuetify] },
    })

    const unassignBtn = wrapper.findAll('button').find(btn => btn.text().includes('Unassign'))
    await unassignBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('assignmentsChanged')).toBeTruthy()
  })

  it('does not emit assignmentsChanged when the unassign request fails', async () => {
    pluginsStoreMock.unassignFromDevice.mockRejectedValue(new Error('unassign failed'))
    // The component does not catch the rejection (finally-only), so swallow it
    // to avoid an unhandled rejection polluting the test run.
    const onUnhandled = (e: unknown) => {}
    process.on('unhandledRejection', onUnhandled)
    const wrapper = mount(PluginCard, {
      props: { plugin: basePlugin, deviceId: 'device-1' },
      global: { plugins: [createPinia(), vuetify] },
    })

    const unassignBtn = wrapper.findAll('button').find(btn => btn.text().includes('Unassign'))
    await unassignBtn!.trigger('click')
    await flushPromises()
    process.off('unhandledRejection', onUnhandled)

    expect(wrapper.emitted('assignmentsChanged')).toBeUndefined()
  })
})
