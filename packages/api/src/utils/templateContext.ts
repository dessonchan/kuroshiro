import type { Device } from '../devices/devices.entity'

/**
 * Build the `trmnl` template context object exposed to LiquidJS templates.
 * Sensitive fields (apikey, mirrorApikey) are intentionally excluded.
 *
 * When a device is provided, width/height are swapped for 90°/270° rotation
 * so templates see the dimensions that match the actual rendered viewport.
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
    const isSwapped = device.rotation === 90 || device.rotation === 270
    const displayWidth = isSwapped ? (device.height || 480) : (device.width || 800)
    const displayHeight = isSwapped ? (device.width || 800) : (device.height || 480)

    ctx.trmnl.device = {
      id: device.id,
      name: device.name,
      friendly_id: device.friendlyId,
      mac: device.mac,
      battery_voltage: device.batteryVoltage ?? null,
      fw_version: device.fwVersion ?? null,
      refresh_rate: device.refreshRate,
      rssi: device.rssi ?? null,
      width: displayWidth,
      height: displayHeight,
      rotation: device.rotation,
      mirror_enabled: device.mirrorEnabled ?? false,
      last_seen: device.lastSeen?.toISOString() ?? null,
    }
  }

  return ctx
}