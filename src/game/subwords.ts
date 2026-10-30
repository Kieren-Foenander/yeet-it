import { Array, Order, pipe } from 'effect'

import { countsFitWithin, letterCounts } from './letters.ts'
import { MINIMUM_LENGTH } from './rules.ts'

const byLengthDescending = Order.mapInput(
  Order.flip(Order.Number),
  (word: string) => word.length,
)

/** Accepted words spellable from `start` that are shorter than it and at least three letters: longest first, then alphabetical. */
export const spellableWords = (
  start: string,
  accepted: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const available = letterCounts(start)

  return pipe(
    accepted.flatMap(word =>
      word.length >= MINIMUM_LENGTH &&
      word.length < start.length &&
      countsFitWithin(letterCounts(word), available)
        ? [word]
        : [],
    ),
    Array.sort(Order.combine(byLengthDescending, Order.String)),
  )
}
