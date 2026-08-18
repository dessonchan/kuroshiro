export interface Device {
  id: string
  name: string
  friendlyId: string
  mac: string
  apikey: string
  batteryVoltage?: string
  fwVersion?: string
  refreshRate?: number
  rssi?: string
  userAgent?: string
  width?: number
  height?: number
  mirrorEnabled: boolean
  mirrorMac: string
  mirrorApikey: string
  specialFunction: string
  resetDevice: boolean
  updateFirmware: boolean
  lastSeen: string
  buttons?: string[]
  offSchedule: ScheduleConfig | null
  timezone: string
  screenSaverScreenId: string | null
}

export interface ActionButton {
  id: string
  button: string
  actionType: 'display_screen' | 'webhook'
  screenId?: string | null
  webhookUrl?: string | null
  webhookMethod?: string
  webhookPayload?: string | null
  deviceId: string
  createdAt: string
  updatedAt: string
}

export interface Screen {
  id: string
  type?: 'file' | 'external' | 'html' | 'plugin' | 'mashup'
  filename?: string | null
  externalLink?: string | null
  isActive: boolean
  device: string | { id: string }
  fetchManual: boolean
  html?: string | null
  plugin?: { id: string, name: string } | null
  devicePluginId?: string | null
  cachedPluginOutput?: string | null
  mashupConfiguration?: { id: string, layout: string }
  order?: number
  enableSchedule: ScheduleConfig | null
}

export interface CurrentScreen {
  filename: string
  image_url: string
  refresh_rate: number
  rendered_at: string
}

export interface LogEntry {
  logId: number
  date: Date
  entry: string
}

export interface OrphanedScreenFile {
  deviceId: string
  screenId: string
  path: string
  size: number
}

export interface OrphanedDeviceDir {
  deviceId: string
  path: string
  fileCount: number
  size: number
}

export interface BrokenScreen {
  screenId: string
  deviceId: string
  filename: string
  type: string
}

export interface TempFile {
  path: string
  age: number
  size: number
}

export interface MaintenanceIssues {
  orphanedScreenFiles: OrphanedScreenFile[]
  orphanedDeviceDirs: OrphanedDeviceDir[]
  brokenScreens: BrokenScreen[]
  tempFiles: TempFile[]
  oldUploads: TempFile[]
  totalSize: number
  scannedAt: string
}

export interface CleanupResult {
  filesDeleted: number
  dirsDeleted: number
  screensDeleted: number
  bytesFreed: number
  errors: string[]
}

export interface MaintenanceStats {
  fileCount: number
  totalSize: number
}

export interface ScheduleRule {
  startTime: string  // "HH:mm" format, e.g. "23:00"
  endTime: string    // "HH:mm" format, e.g. "07:00"
  weekdays: number[] // 0=Sunday, 1=Monday, ..., 6=Saturday. Empty array = inactive
}

export type ScheduleConfig = ScheduleRule[] | null
