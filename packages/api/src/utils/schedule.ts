import type { ScheduleConfig, ScheduleRule } from '../schedule-config.interface'

/**
 * Parse "HH:mm" into minutes since midnight.
 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Get current weekday (0=Sunday) and minutes since midnight in the given timezone.
 */
function nowInTimezone(timezone: string): { weekday: number, minutes: number } {
  const now = new Date()
  // Use Intl to get the time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23', // force 00:00–23:59, never "24:00" at midnight
  })
  const parts = formatter.formatToParts(now)
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0'
  const minuteStr = parts.find(p => p.type === 'minute')?.value ?? '0'
  const hour = Number.parseInt(hourStr, 10)
  const minute = Number.parseInt(minuteStr, 10)
  return {
    weekday: weekdayMap[weekdayStr] ?? 0,
    minutes: hour * 60 + minute,
  }
}

/**
 * Check if a single rule matches the current time.
 */
function ruleMatches(rule: ScheduleRule, weekday: number, minutes: number): boolean {
  // Check weekday
  if (rule.weekdays.length === 0)
    return false // empty weekdays = inactive
  if (!rule.weekdays.includes(weekday))
    return false

  const start = parseTimeToMinutes(rule.startTime)
  const end = parseTimeToMinutes(rule.endTime)

  if (start <= end) {
    // Same day: e.g. 09:00–17:00
    return minutes >= start && minutes < end
  }
  else {
    // Crosses midnight: e.g. 23:00–07:00
    return minutes >= start || minutes < end
  }
}

/**
 * Check if the current time falls within any rule of the schedule config.
 * null or empty array = no schedule = not "in schedule" (always on/enabled).
 */
export function isInSchedule(schedule: ScheduleConfig, timezone: string): boolean {
  if (!schedule || schedule.length === 0)
    return false

  const { weekday, minutes } = nowInTimezone(timezone)
  return schedule.some(rule => ruleMatches(rule, weekday, minutes))
}

/**
 * Calculate seconds until the soonest matching rule ends.
 * Used for dynamic refresh_rate during off/sleep periods.
 * Returns a large number if no rule is currently active.
 */
export function secondsUntilScheduleEnd(schedule: ScheduleConfig, timezone: string): number {
  if (!schedule || schedule.length === 0)
    return 3600

  const { weekday, minutes } = nowInTimezone(timezone)
  let minSeconds = Infinity

  for (const rule of schedule) {
    if (!ruleMatches(rule, weekday, minutes))
      continue

    const end = parseTimeToMinutes(rule.endTime)
    const nowSeconds = minutes * 60

    if (end > minutes) {
      // Ends later today
      const seconds = end * 60 - nowSeconds
      if (seconds < minSeconds)
        minSeconds = seconds
    }
    else {
      // Ends tomorrow (crosses midnight)
      const seconds = (24 * 60 - minutes + end) * 60
      if (seconds < minSeconds)
        minSeconds = seconds
    }
  }

  return minSeconds === Infinity ? 3600 : Math.max(60, minSeconds)
}
