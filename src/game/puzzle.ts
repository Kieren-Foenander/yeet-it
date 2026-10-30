import { Schema } from 'effect'

import { IsoDate } from './day.ts'

export const PUZZLE_FORMAT = 'yeet-it.puzzle/v1'

export const UppercaseWord = Schema.String.check(
  Schema.isPattern(/^[A-Z]{3,9}$/),
)

/** The only puzzle data the browser receives: today's start word and the accepted words it contains. */
export const Puzzle = Schema.Struct({
  format: Schema.Literal(PUZZLE_FORMAT),
  number: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  date: IsoDate,
  start: UppercaseWord,
  words: Schema.Array(UppercaseWord),
  route: Schema.Array(UppercaseWord),
  dictionary: Schema.String,
})

export type Puzzle = typeof Puzzle.Type
