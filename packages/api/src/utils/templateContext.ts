import type { Device } from '../devices/devices.entity'

/**
 * Build the `trmnl` template context object exposed to LiquidJS templates.
 * Sensitive fields (apikey, mirrorApikey) are intentionally excluded.
 */
export function buildTrmnlContext(options: {
  instanceName: string
  device?: Device
  userId?: string
  locale?: string
}) {
  const { instanceName, device, userId = 'kuroshiro-user', locale = 'en' } = options

  const ctx: Record<string, any> = {
    trmnl: {
      system: {
        timestamp_utc: Math.floor(Date.now() / 1000),
      },
      plugin_settings: {
        instance_name: instanceName,
        strategy: 'polling',
        dark_mode: 'no',
        no_screen_padding: 'no',
      },
      user: {
        id: userId,
        locale,
      },
    },
  }

  if (device) {
    ctx.trmnl.device = {
      id: device.id,
      name: device.name,
      friendly_id: device.friendlyId,
      mac: device.mac,
      battery_voltage: device.batteryVoltage ?? null,
      fw_version: device.fwVersion ?? null,
      refresh_rate: device.refreshRate,
      rssi: device.rssi ?? null,
      width: device.width ?? null,
      height: device.height ?? null,
      rotation: device.rotation,
      mirror_enabled: device.mirrorEnabled ?? false,
      last_seen: device.lastSeen?.toISOString() ?? null,
    }
  }

  return ctx
}