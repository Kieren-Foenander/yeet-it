import { Array, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  countsFitWithin,
  fitsWithin,
  leftoverLetters,
  letterCounts,
} from './letters.ts'

export const START_LENGTH = 9

export const MINIMUM_LENGTH = 3

/** Word lengths that can score, longest first: 8, 7, 6, 5, 4, 3. */
export const SCORING_LENGTHS: ReadonlyArray<number> = Array.makeBy(
  START_LENGTH - MINIMUM_LENGTH,
  index => START_LENGTH - 1 - index,
)

export const MAXIMUM_SCORE = SCORING_LENGTHS.length

export const MoveVerdict = defineTaggedUnion({
  Empty: {},
  UsesMissingLetters: {},
  TooShort: {},
  NotShorter: {},
  NotAWord: {},
  Valid: { removed: Schema.Array(Schema.String) },
})

export type MoveVerdict = typeof MoveVerdict.Type

/** Judge a draft against the current word. `isAccepted` answers dictionary membership. */
export const judgeMove = (
  current: string,
  draft: string,
  isAccepted: (word: string) => boolean,
): MoveVerdict => {
  if (draft.length === 0) {
    return MoveVerdict.Empty()
  }

  if (!fitsWithin(draft, current)) {
    return MoveVerdict.UsesMissingLetters()
  }

  if (draft.length < MINIMUM_LENGTH) {
    return MoveVerdict.TooShort()
  }

  if (draft.length >= current.length) {
    return MoveVerdict.NotShorter()
  }

  if (!isAccepted(draft)) {
    return MoveVerdict.NotAWord()
  }

  return MoveVerdict.Valid({ removed: leftoverLetters(current, draft) })
}

/** True when some accepted word of at least three letters can still be made by removing letters. */
export const hasShorterWord = (
  current: string,
  words: ReadonlyArray<string>,
): boolean => {
  const available = letterCounts(current)

  return words.some(
    word =>
      word.length >= MINIMUM_LENGTH &&
      word.length < current.length &&
      countsFitWithin(letterCounts(word), available),
  )
}
