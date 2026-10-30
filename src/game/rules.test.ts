import { describe, expect, test } from 'vitest'

import { ballrooms } from './fixtures.ts'
import {
  hasShorterWord,
  judgeMove,
  MoveVerdict,
  SCORING_LENGTHS,
} from './rules.ts'

const accepted = new Set(ballrooms.words)

const judge = (current: string, draft: string) =>
  judgeMove(current, draft, word => accepted.has(word))

describe('judgeMove', () => {
  test('scores lengths 8 down to 3', () => {
    expect(SCORING_LENGTHS).toStrictEqual([8, 7, 6, 5, 4, 3])
  })

  test('accepts a shorter accepted word and reports the yeeted letters', () => {
    expect(judge('BALLROOMS', 'BROOMS')).toStrictEqual(
      MoveVerdict.Valid({ removed: ['A', 'L', 'L'] }),
    )
  })

  test('rejects letters that are not available, including extra duplicates', () => {
    expect(judge('BALLROOMS', 'BALLLS')).toStrictEqual(
      MoveVerdict.UsesMissingLetters(),
    )
    expect(judge('BROOMS', 'BALL')).toStrictEqual(
      MoveVerdict.UsesMissingLetters(),
    )
  })

  test('rejects same-length anagrams: at least one letter must go', () => {
    expect(judge('BROOMS', 'BROOMS')).toStrictEqual(MoveVerdict.NotShorter())
    expect(judge('BLOOM', 'BLOOM')).toStrictEqual(MoveVerdict.NotShorter())
  })

  test('rejects words under three letters', () => {
    expect(judge('BALLROOMS', 'OM')).toStrictEqual(MoveVerdict.TooShort())
  })

  test('rejects words outside the dictionary without penalty', () => {
    expect(judge('BALLROOMS', 'BLAMS')).toStrictEqual(MoveVerdict.NotAWord())
  })

  test('treats an empty draft as nothing to judge', () => {
    expect(judge('BALLROOMS', '')).toStrictEqual(MoveVerdict.Empty())
  })
})

describe('hasShorterWord', () => {
  test('finds a continuation when one exists', () => {
    expect(hasShorterWord('BLOOM', ballrooms.words)).toBe(true)
  })

  test('detects a true dead end', () => {
    expect(hasShorterWord('ROLLS', ballrooms.words)).toBe(false)
  })
})
