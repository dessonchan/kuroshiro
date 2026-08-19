import { describe, expect, it } from 'vitest'
import { buildTrmnlContext } from '../templateContext'

describe('buildTrmnlContext', () => {
  it('builds the trmnl system and plugin_settings blocks', () => {
    const ctx = buildTrmnlContext({ instanceName: 'My Plugin' })

    expect(ctx.trmnl.system.timestamp_utc).toBeTypeOf('number')
    expect(ctx.trmnl.plugin_settings.instance_name).toBe('My Plugin')
    expect(ctx.trmnl.plugin_settings.strategy).toBe('polling')
    expect(ctx.trmnl.plugin_settings.dark_mode).toBe('no')
    expect(ctx.trmnl.plugin_settings.no_screen_padding).toBe('no')
    expect(ctx.trmnl.user.id).toBe('kuroshiro-user')
    expect(ctx.trmnl.user.locale).toBe('en')
  })

  it('does not include a device block when no device is provided', () => {
    const ctx = buildTrmnlContext({ instanceName: 'X' })
    expect(ctx.trmnl.device).toBeUndefined()
  })

  it('exposes device fields and never leaks the apikey', () => {
    const device: any = {
      id: 'dev-1',
      name: 'Kitchen',
      friendlyId: 'abc',
      mac: '00:11:22:33:44:55',
      batteryVoltage: 3.7,
      fwVersion: '1.2.3',
      refreshRate: 60,
      rssi: -45,
      rotation: 0,
      mirrorEnabled: false,
      lastSeen: new Date('2026-01-01T00:00:00.000Z'),
      apikey: 'secret-key',
      mirrorApikey: 'mirror-secret',
    }

    const ctx = buildTrmnlContext({ instanceName: 'X', device })

    expect(ctx.trmnl.device.id).toBe('dev-1')
    expect(ctx.trmnl.device.name).toBe('Kitchen')
    expect(ctx.trmnl.device.friendly_id).toBe('abc')
    expect(ctx.trmnl.device.mac).toBe('00:11:22:33:44:55')
    expect(ctx.trmnl.device.battery_voltage).toBe(3.7)
    expect(ctx.trmnl.device.fw_version).toBe('1.2.3')
    expect(ctx.trmnl.device.refresh_rate).toBe(60)
    expect(ctx.trmnl.device.rssi).toBe(-45)
    expect(ctx.trmnl.device.rotation).toBe(0)
    expect(ctx.trmnl.device.mirror_enabled).toBe(false)
    expect(ctx.trmnl.device.last_seen).toBe('2026-01-01T00:00:00.000Z')
    expect(JSON.stringify(ctx)).not.toContain('secret-key')
    expect(JSON.stringify(ctx)).not.toContain('mirror-secret')
  })

  it('uses native width/height for 0 and 180 degree rotation', () => {
    const device: any = { id: 'd', width: 800, height: 480, rotation: 0 }
    const ctx = buildTrmnlContext({ instanceName: 'X', device })
    expect(ctx.trmnl.device.width).toBe(800)
    expect(ctx.trmnl.device.height).toBe(480)
  })

  it('swaps width/height for 90 and 270 degree rotation', () => {
    const device90: any = { id: 'd', width: 800, height: 480, rotation: 90 }
    const ctx90 = buildTrmnlContext({ instanceName: 'X', device: device90 })
    expect(ctx90.trmnl.device.width).toBe(480)
    expect(ctx90.trmnl.device.height).toBe(800)

    const device270: any = { id: 'd', width: 800, height: 480, rotation: 270 }
    const ctx270 = buildTrmnlContext({ instanceName: 'X', device: device270 })
    expect(ctx270.trmnl.device.width).toBe(480)
    expect(ctx270.trmnl.device.height).toBe(800)
  })

  it('falls back to default dimensions when width/height are missing', () => {
    const device: any = { id: 'd', rotation: 0 }
    const ctx = buildTrmnlContext({ instanceName: 'X', device })
    expect(ctx.trmnl.device.width).toBe(800)
    expect(ctx.trmnl.device.height).toBe(480)
  })

  it('allows overriding the user id and locale', () => {
    const ctx = buildTrmnlContext({ instanceName: 'X', userId: 'u-1', locale: 'zh' })
    expect(ctx.trmnl.user.id).toBe('u-1')
    expect(ctx.trmnl.user.locale).toBe('zh')
  })
})
