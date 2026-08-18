import type { ScheduleConfig } from './schedule-config.interface'

/**
 * Check if the current time falls within a schedule config.
 * Handles midnight crossing (e.g. 23:00–07:00).
 * Weekdays: 0=Sunday, 1=Monday, ..., 6=Saturday (matches JS Date.getDay()).
 * Empty weekdays array or null schedule = inactive.
 */
export function isInSchedule(schedule: ScheduleConfig | null | undefined, timezone: string): boolean {
  if (!schedule || !schedule.weekdays || schedule.weekdays.length === 0)
    return false

  const now = new Date()
  const tz = timezone || 'UTC'

  // Get current time and weekday in the device timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  })
  const parts = formatter.formatToParts(now)
  const hour = Number(parts.find(p => p.type === 'hour')!.value)
  const minute = Number(parts.find(p => p.type === 'minute')!.value)
  const currentMinutes = hour * 60 + minute

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekdayPart = parts.find(p => p.type === 'weekday')!.value
  const currentDay = dayMap[weekdayPart]
  if (currentDay === undefined || !schedule.weekdays.includes(currentDay))
    return false

  const [startH, startM] = schedule.startTime.split(':').map(Number)
  const [endH, endM] = schedule.endTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes <= endMinutes) {
    // Same day range: e.g. 09:00–17:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
  else {
    // Crosses midnight: e.g. 23:00–07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
}

/**
 * Calculate seconds remaining until the end of a schedule.
 * Returns 0 if not currently in schedule.
 */
export function secondsUntilScheduleEnd(schedule: ScheduleConfig, timezone: string): number {
  const now = new Date()
  const tz = timezone || 'UTC'

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const hour = Number(parts.find(p => p.type === 'hour')!.value)
  const minute = Number(parts.find(p => p.type === 'minute')!.value)
  const currentMinutes = hour * 60 + minute

  const [startH, startM] = schedule.startTime.split(':').map(Number)
  const [endH, endM] = schedule.endTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  let minutesUntilEnd: number
  if (startMinutes <= endMinutes) {
    // Same day range
    minutesUntilEnd = endMinutes - currentMinutes
  }
  else {
    // Crosses midnight
    if (currentMinutes >= startMinutes) {
      // We're after start, end is tomorrow
      minutesUntilEnd = (24 * 60 - currentMinutes) + endMinutes
    }
    else {
      // We're before end, end is later today
      minutesUntilEnd = endMinutes - currentMinutes
    }
  }

  return minutesUntilEnd * 60
}