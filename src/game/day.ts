import { Schema } from 'effect'

/** Puzzle #1 is the first UTC day of the published schedule. */
export const EPOCH_DATE = '2026-10-30'

const DAY_MS = 86_400_000

export const IsoDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/),
)

export type IsoDate = typeof IsoDate.Type

const pad = (value: number, width: number): string =>
  value.toString().padStart(width, '0')

export const utcDateOf = (epochMs: number): IsoDate => {
  const date = new Date(epochMs)

  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`
}

export const startOfUtcDay = (isoDate: IsoDate): number =>
  Date.parse(`${isoDate}T00:00:00.000Z`)

export const isValidIsoDate = (raw: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
  Number.isFinite(startOfUtcDay(raw)) &&
  utcDateOf(startOfUtcDay(raw)) === raw

export const addDays = (isoDate: IsoDate, days: number): IsoDate =>
  utcDateOf(startOfUtcDay(isoDate) + days * DAY_MS)

export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  Math.round((startOfUtcDay(to) - startOfUtcDay(from)) / DAY_MS)

export const puzzleNumberOf = (isoDate: IsoDate): number =>
  daysBetween(EPOCH_DATE, isoDate) + 1

export const msUntilNextUtcDay = (epochMs: number): number =>
  startOfUtcDay(utcDateOf(epochMs)) + DAY_MS - epochMs

/** Monday = 0 … Sunday = 6, in UTC. */
export const utcWeekday = (isoDate: IsoDate): number =>
  (new Date(startOfUtcDay(isoDate)).getUTCDay() + 6) % 7

export const formatPuzzleNumber = (puzzleNumber: number): string =>
  `#${pad(puzzleNumber, 3)}`
