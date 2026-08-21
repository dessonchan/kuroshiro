import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import DeviceInformationCard from '../DeviceInformationCard.vue'

let deviceMock: any
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    getById: vi.fn(() => deviceMock),
    deleteDevice: vi.fn(),
  }),
}))

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

function mountCard() {
  return mount(DeviceInformationCard, {
    props: { deviceId: 'device1' },
    global: {
      plugins: [createPinia(), vuetify],
      mocks: { $router: { push: vi.fn() } },
    },
  })
}

describe('deviceInformationCard next refresh time', () => {
  it('shows N/A when the device has no lastSeen or refreshRate', () => {
    deviceMock = {
      id: 'device1',
      name: 'Test Device',
      mac: 'AA:BB:CC:DD:EE:FF',
      apikey: 'apikey',
      mirrorEnabled: false,
      mirrorMac: '',
      mirrorApikey: '',
      specialFunction: '',
      resetDevice: false,
      updateFirmware: false,
      lastSeen: '',
      refreshRate: undefined,
    }
    const wrapper = mountCard()
    expect(wrapper.find('[data-test-id="next-refresh-time"]').text()).toContain('N/A')
  })

  it('shows lastSeen + refreshRate as the next refresh time', () => {
    const lastSeen = '2026-01-01T00:00:00.000Z'
    deviceMock = {
      id: 'device1',
      name: 'Test Device',
      mac: 'AA:BB:CC:DD:EE:FF',
      apikey: 'apikey',
      mirrorEnabled: false,
      mirrorMac: '',
      mirrorApikey: '',
      specialFunction: '',
      resetDevice: false,
      updateFirmware: false,
      lastSeen,
      refreshRate: 300, // 5 minutes
    }
    const wrapper = mountCard()
    const text = wrapper.find('[data-test-id="next-refresh-time"]').text()
    // Expected next refresh = 00:05:00 UTC
    expect(text).toContain('00:05:00')
  })

  it('shows N/A when the device has a lastSeen but no refreshRate', () => {
    deviceMock = {
      id: 'device1',
      name: 'Test Device',
      mac: 'AA:BB:CC:DD:EE:FF',
      apikey: 'apikey',
      mirrorEnabled: false,
      mirrorMac: '',
      mirrorApikey: '',
      specialFunction: '',
      resetDevice: false,
      updateFirmware: false,
      lastSeen: '2026-01-01T00:00:00.000Z',
      refreshRate: undefined,
    }
    const wrapper = mountCard()
    expect(wrapper.find('[data-test-id="next-refresh-time"]').text()).toContain('N/A')
  })
})
