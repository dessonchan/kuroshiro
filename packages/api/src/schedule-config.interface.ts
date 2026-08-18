/**
 * Shared schedule configuration format.
 *
 * - startTime / endTime: "HH:mm" format (24h), e.g. "23:00", "07:00"
 * - weekdays: 0–6 where 0=Sunday (matches JS Date.getDay()). Empty array = schedule inactive (same as null).
 * - If startTime > endTime the range crosses midnight (e.g. 23:00–07:00 means from 23:00 today to 07:00 tomorrow).
 * - null = schedule not configured → device always on / screen always enabled.
 */
export interface ScheduleConfig {
  startTime: string
  endTime: string
  weekdays: number[]
}