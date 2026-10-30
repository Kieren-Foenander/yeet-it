import { describe, expect, test } from 'vitest'

import {
  fitsWithin,
  leftoverLetters,
  letterCounts,
  multisetKey,
  normalizeWord,
  usedPositions,
} from './letters.ts'

describe('letters', () => {
  test('normalizes typed input to uppercase letters', () => {
    expect(normalizeWord(' ro-om 9s ')).toBe('ROOMS')
  })

  test('counts duplicate letters', () => {
    expect(letterCounts('BALLOON')[11]).toBe(2)
    expect(letterCounts('BALLOON')[14]).toBe(2)
  })

  test('respects duplicate letter counts', () => {
    expect(fitsWithin('BALLS', 'BALLROOMS')).toBe(true)
    expect(fitsWithin('BALLLS', 'BALLROOMS')).toBe(false)
    expect(fitsWithin('LOOMS', 'BALLROOMS')).toBe(true)
    expect(fitsWithin('LOOOMS', 'BALLROOMS')).toBe(false)
  })

  test('lists leftover letters in the original order', () => {
    expect(leftoverLetters('BALLROOMS', 'BROOMS')).toStrictEqual([
      'A',
      'L',
      'L',
    ])
    expect(leftoverLetters('BALLROOMS', 'ROLLS')).toStrictEqual([
      'B',
      'A',
      'O',
      'M',
    ])
  })

  test('marks the earliest duplicates as used by a draft', () => {
    expect(usedPositions('BALLROOMS', 'LOL')).toStrictEqual([
      false,
      false,
      true,
      true,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  test('identifies anagrams by multiset', () => {
    expect(multisetKey('RELATIONS')).toBe(multisetKey('ORIENTALS'))
  })
})
