import { Array, Data, Option } from 'effect'

import { addDays, type IsoDate, isValidIsoDate } from '../game/day.ts'
import { PUZZLE_FORMAT, type Puzzle } from '../game/puzzle.ts'
import { spellableWords } from '../game/subwords.ts'
import type { Schedule } from '../generator/schedule.ts'

/** Allow one day ahead so a device clock slightly past midnight UTC still gets its puzzle. */
export const MAXIMUM_DAYS_AHEAD = 1

export type Lookup = Data.TaggedEnum<{
  Found: { readonly puzzle: Puzzle }
  InvalidDate: {}
  NotYet: {}
  Unscheduled: {}
}>

export const Lookup = Data.taggedEnum<Lookup>()

export const puzzleFor = (
  schedule: Schedule,
  dictionary: ReadonlyArray<string>,
  dictionaryVersion: string,
  date: string,
  today: IsoDate,
): Lookup => {
  if (!isValidIsoDate(date)) {
    return Lookup.InvalidDate()
  }

  if (date > addDays(today, MAXIMUM_DAYS_AHEAD)) {
    return Lookup.NotYet()
  }

  return Option.match(
    Array.findFirst(schedule.entries, entry => entry.date === date),
    {
      onNone: () => Lookup.Unscheduled(),
      onSome: entry =>
        Lookup.Found({
          puzzle: {
            format: PUZZLE_FORMAT,
            number: entry.number,
            date: entry.date,
            start: entry.start,
            words: spellableWords(entry.start, dictionary),
            route: entry.route,
            dictionary: dictionaryVersion,
          },
        }),
    },
  )
}
