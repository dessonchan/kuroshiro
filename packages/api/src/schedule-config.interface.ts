/**
 * A single schedule rule.
 *
 * - startTime / endTime: "HH:mm" format (24h), e.g. "23:00", "07:00"
 * - weekdays: 0–6 where 0=Sunday (matches JS Date.getDay()). Empty array = inactive.
 *   When startTime > endTime (e.g. 23:00–07:00), the range crosses midnight.
 */
export interface ScheduleRule {
  startTime: string
  endTime: string
  weekdays: number[]
}

/**
 * A schedule is an array of rules. The device/screen is "in schedule" when
 * the current time matches ANY rule. Empty array or null = no schedule (always on/enabled).
 */
export type ScheduleConfig = ScheduleRule[] | null