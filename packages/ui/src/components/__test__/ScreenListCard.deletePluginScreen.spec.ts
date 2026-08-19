import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import ScreenListCard from '../ScreenListCard.vue'

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

globalThis.visualViewport = globalThis.visualViewport || {
  addEventListener: () => {},
  removeEventListener: () => {},
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
} as any

let screensStoreMock: any
vi.mock('@/stores/screens', () => ({
  useScreensStore: () => screensStoreMock,
}))
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    getById: vi.fn(() => ({ id: 'device1', width: 800, height: 480 })),
  }),
}))

describe('screenListCard delete plugin screens', () => {
  beforeEach(() => {
    screensStoreMock = {
      screens: [],
      deleteScreen: vi.fn(),
      updateExternalScreen: vi.fn(),
      reorderScreens: vi.fn(),
    }
  })

  it('renders a delete button for a plugin screen', () => {
    screensStoreMock.screens = [
      {
        id: 'plugin-screen-1',
        type: 'plugin',
        filename: 'My Plugin',
        isActive: true,
        device: 'device1',
        fetchManual: false,
        plugin: { id: 'plugin-1', name: 'My Plugin' },
      },
    ]
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: { plugins: [createPinia(), vuetify] },
    })

    expect(wrapper.find('[data-test-id="screen-delete-btn-plugin-screen-1"]').exists()).toBe(true)
  })

  it('calls deleteScreen when the delete button on a plugin screen is clicked', async () => {
    screensStoreMock.screens = [
      {
        id: 'plugin-screen-1',
        type: 'plugin',
        filename: 'My Plugin',
        isActive: true,
        device: 'device1',
        fetchManual: false,
        plugin: { id: 'plugin-1', name: 'My Plugin' },
      },
    ]
    screensStoreMock.deleteScreen.mockResolvedValue(undefined)
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: { plugins: [createPinia(), vuetify] },
    })

    await wrapper.find('[data-test-id="screen-delete-btn-plugin-screen-1"]').trigger('click')
    await flushPromises()

    expect(screensStoreMock.deleteScreen).toHaveBeenCalledWith('device1', 'plugin-screen-1')
  })
})
