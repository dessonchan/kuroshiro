import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isInSchedule, secondsUntilScheduleEnd } from '../schedule'
import type { ScheduleConfig } from '../../schedule-config.interface'

// Helper: set the current time (UTC) so nowInTimezone('UTC') is deterministic.
function setNow(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

describe('isInSchedule', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false when the schedule is null', () => {
    expect(isInSchedule(null, 'UTC')).toBe(false)
  })

  it('returns false when the schedule is an empty array', () => {
    expect(isInSchedule([], 'UTC')).toBe(false)
  })

  it('returns true when the current time is inside a same-day rule', () => {
    setNow('2026-01-04T10:00:00Z') // Sunday 10:00
    const schedule: ScheduleConfig = [{ startTime: '09:00', endTime: '17:00', weekdays: [0] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(true)
  })

  it('returns false when the current time is outside a same-day rule', () => {
    setNow('2026-01-04T18:00:00Z') // Sunday 18:00
    const schedule: ScheduleConfig = [{ startTime: '09:00', endTime: '17:00', weekdays: [0] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(false)
  })

  it('returns false when the current weekday is not in the rule', () => {
    setNow('2026-01-05T10:00:00Z') // Monday 10:00
    const schedule: ScheduleConfig = [{ startTime: '09:00', endTime: '17:00', weekdays: [0] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(false)
  })

  it('returns false when the rule has an empty weekdays array (inactive)', () => {
    setNow('2026-01-04T10:00:00Z')
    const schedule: ScheduleConfig = [{ startTime: '09:00', endTime: '17:00', weekdays: [] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(false)
  })

  it('matches a rule that crosses midnight', () => {
    setNow('2026-01-05T02:00:00Z') // Monday 02:00
    const schedule: ScheduleConfig = [{ startTime: '23:00', endTime: '07:00', weekdays: [1] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(true)
  })

  it('matches when any rule in a multi-rule schedule is active', () => {
    setNow('2026-01-04T20:00:00Z') // Sunday 20:00
    const schedule: ScheduleConfig = [
      { startTime: '09:00', endTime: '17:00', weekdays: [0] },
      { startTime: '19:00', endTime: '21:00', weekdays: [0] },
    ]
    expect(isInSchedule(schedule, 'UTC')).toBe(true)
  })
})

describe('secondsUntilScheduleEnd', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 3600 when the schedule is null', () => {
    expect(secondsUntilScheduleEnd(null, 'UTC')).toBe(3600)
  })

  it('returns 3600 when no rule is currently active', () => {
    setNow('2026-01-04T18:00:00Z') // Sunday 18:00
    const schedule: ScheduleConfig = [{ startTime: '09:00', endTime: '17:00', weekdays: [0] }]
    expect(secondsUntilScheduleEnd(schedule, 'UTC')).toBe(3600)
  })

  it('returns the seconds until the active rule ends later today', () => {
    setNow('2026-01-04T10:00:00Z') // Sunday 10:00, ends 17:00 = 7h = 25200s
    const schedule: ScheduleConfig = [{ startTime: '09:00', endTime: '17:00', weekdays: [0] }]
    expect(secondsUntilScheduleEnd(schedule, 'UTC')).toBe(25200)
  })

  it('returns the seconds until a midnight-crossing rule ends tomorrow', () => {
    setNow('2026-01-05T02:00:00Z') // Monday 02:00, ends 07:00 = 5h = 18000s
    const schedule: ScheduleConfig = [{ startTime: '23:00', endTime: '07:00', weekdays: [1] }]
    expect(secondsUntilScheduleEnd(schedule, 'UTC')).toBe(18000)
  })

  it('returns the soonest end among multiple active rules', () => {
    setNow('2026-01-04T10:00:00Z') // Sunday 10:00
    const schedule: ScheduleConfig = [
      { startTime: '09:00', endTime: '17:00', weekdays: [0] }, // ends 17:00
      { startTime: '08:00', endTime: '11:00', weekdays: [0] }, // ends 11:00 (soonest)
    ]
    expect(secondsUntilScheduleEnd(schedule, 'UTC')).toBe(3600)
  })
})
