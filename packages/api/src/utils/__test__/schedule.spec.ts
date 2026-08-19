import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isInSchedule, secondsUntilScheduleEnd } from '../schedule'

// Control the "current time" by mocking Intl.DateTimeFormat so nowInTimezone
// returns a fixed weekday + minutes.
function mockNow(weekday: string, hour: number, minute: number) {
  const parts = [
    { type: 'weekday', value: weekday },
    { type: 'hour', value: String(hour).padStart(2, '0') },
    { type: 'minute', value: String(minute).padStart(2, '0') },
  ]
  const original = Intl.DateTimeFormat
  ;(Intl as any).DateTimeFormat = class {
    formatToParts() {
      return parts
    }
  }
  return () => {
    ;(Intl as any).DateTimeFormat = original
  }
}

describe('schedule isInSchedule', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when the schedule is null or empty', () => {
    expect(isInSchedule(null as any, 'UTC')).toBe(false)
    expect(isInSchedule([], 'UTC')).toBe(false)
  })

  it('returns false when the current weekday is not in the rule', () => {
    const restore = mockNow('Mon', 10, 0)
    const schedule = [{ startTime: '09:00', endTime: '17:00', weekdays: [0] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(false)
    restore()
  })

  it('returns true when the current time is within a same-day rule', () => {
    const restore = mockNow('Mon', 12, 0)
    const schedule = [{ startTime: '09:00', endTime: '17:00', weekdays: [1] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(true)
    restore()
  })

  it('returns false when the current time is before the rule start', () => {
    const restore = mockNow('Mon', 8, 0)
    const schedule = [{ startTime: '09:00', endTime: '17:00', weekdays: [1] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(false)
    restore()
  })

  it('returns false when the current time is at or after the rule end', () => {
    const restore = mockNow('Mon', 17, 0)
    const schedule = [{ startTime: '09:00', endTime: '17:00', weekdays: [1] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(false)
    restore()
  })

  it('handles a rule that crosses midnight', () => {
    // 23:00–07:00, at 02:00 should be in schedule
    const restore = mockNow('Tue', 2, 0)
    const schedule = [{ startTime: '23:00', endTime: '07:00', weekdays: [1, 2] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(true)
    restore()
  })

  it('returns true if any rule matches', () => {
    const restore = mockNow('Wed', 20, 0)
    const schedule = [
      { startTime: '09:00', endTime: '17:00', weekdays: [3] },
      { startTime: '18:00', endTime: '22:00', weekdays: [3] },
    ]
    expect(isInSchedule(schedule, 'UTC')).toBe(true)
    restore()
  })

  it('treats a rule with empty weekdays as inactive', () => {
    const restore = mockNow('Mon', 12, 0)
    const schedule = [{ startTime: '09:00', endTime: '17:00', weekdays: [] }]
    expect(isInSchedule(schedule, 'UTC')).toBe(false)
    restore()
  })
})

describe('schedule secondsUntilScheduleEnd', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 3600 when the schedule is null or empty', () => {
    expect(secondsUntilScheduleEnd(null as any, 'UTC')).toBe(3600)
    expect(secondsUntilScheduleEnd([], 'UTC')).toBe(3600)
  })

  it('returns seconds until the rule ends later today', () => {
    const restore = mockNow('Mon', 10, 0)
    const schedule = [{ startTime: '09:00', endTime: '17:00', weekdays: [1] }]
    // 7 hours = 25200 seconds
    expect(secondsUntilScheduleEnd(schedule, 'UTC')).toBe(25200)
    restore()
  })

  it('returns seconds until the rule ends tomorrow when crossing midnight', () => {
    const restore = mockNow('Mon', 23, 30)
    const schedule = [{ startTime: '23:00', endTime: '07:00', weekdays: [1] }]
    // 7:00 tomorrow = 7.5 hours = 27000 seconds
    expect(secondsUntilScheduleEnd(schedule, 'UTC')).toBe(27000)
    restore()
  })

  it('returns 3600 when no rule is currently active', () => {
    const restore = mockNow('Mon', 8, 0)
    const schedule = [{ startTime: '09:00', endTime: '17:00', weekdays: [1] }]
    expect(secondsUntilScheduleEnd(schedule, 'UTC')).toBe(3600)
    restore()
  })

  it('returns the soonest end among multiple matching rules', () => {
    const restore = mockNow('Mon', 10, 0)
    const schedule = [
      { startTime: '09:00', endTime: '11:00', weekdays: [1] },
      { startTime: '09:00', endTime: '17:00', weekdays: [1] },
    ]
    // Soonest end is 11:00 = 1 hour = 3600 seconds
    expect(secondsUntilScheduleEnd(schedule, 'UTC')).toBe(3600)
    restore()
  })
})
