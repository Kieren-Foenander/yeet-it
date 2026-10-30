import { describe, expect, test } from 'vitest'

import {
  addDays,
  EPOCH_DATE,
  formatPuzzleNumber,
  isValidIsoDate,
  msUntilNextUtcDay,
  puzzleNumberOf,
  utcDateOf,
  utcWeekday,
} from './day.ts'

describe('UTC days', () => {
  test('rolls over at midnight UTC regardless of local time zone', () => {
    expect(utcDateOf(Date.parse('2026-10-30T23:59:59.999Z'))).toBe('2026-10-30')
    expect(utcDateOf(Date.parse('2026-10-31T00:00:00.000Z'))).toBe('2026-10-31')
    expect(utcDateOf(Date.parse('2026-10-31T09:30:00+10:00'))).toBe(
      '2026-10-30',
    )
  })

  test('counts milliseconds to the next UTC midnight', () => {
    expect(msUntilNextUtcDay(Date.parse('2026-10-30T23:59:00.000Z'))).toBe(
      60_000,
    )
  })

  test('numbers puzzles from the epoch', () => {
    expect(puzzleNumberOf(EPOCH_DATE)).toBe(1)
    expect(puzzleNumberOf(addDays(EPOCH_DATE, 364))).toBe(365)
    expect(formatPuzzleNumber(1)).toBe('#001')
  })

  test('crosses month and leap-year boundaries', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  test('validates calendar dates', () => {
    expect(isValidIsoDate('2026-10-30')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026-1-3')).toBe(false)
  })

  test('starts weeks on Monday', () => {
    expect(utcWeekday('2026-11-02')).toBe(0)
    expect(utcWeekday('2026-11-08')).toBe(6)
  })
})
