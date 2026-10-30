import { readFileSync } from 'node:fs'

import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import { spellableWords } from '../game/subwords.ts'
import { parseEnable } from '../generator/dictionary.ts'
import { ScheduleJson } from '../generator/schedule.ts'
import { Lookup, puzzleFor } from './puzzles.ts'

const schedule = Schema.decodeUnknownSync(ScheduleJson)(
  readFileSync('data/schedule.json', 'utf8'),
)

const dictionary = parseEnable(readFileSync('data/enable/enable1.txt', 'utf8'))

const lookup = (date: string, today: string) =>
  puzzleFor(
    schedule,
    start => spellableWords(start, dictionary),
    'enable1@test',
    date,
    today,
  )

describe('puzzleFor', () => {
  test("serves today's start word with every accepted shorter word", () => {
    const puzzle = Lookup.$match(lookup('2026-10-30', '2026-10-30'), {
      Found: found => found.puzzle,
      InvalidDate: () => expect.unreachable('invalid date'),
      NotYet: () => expect.unreachable('not yet'),
      Unscheduled: () => expect.unreachable('unscheduled'),
    })

    expect(puzzle.number).toBe(1)
    expect(puzzle.start).toBe(schedule.entries[0]?.start)
    expect(puzzle.route).toStrictEqual(schedule.entries[0]?.route)
    expect(puzzle.words).toContain(puzzle.route[0])
    expect(
      puzzle.words.every(word => word.length >= 3 && word.length <= 8),
    ).toBe(true)
  })

  test('allows one day ahead for fast clocks but no further', () => {
    expect(Lookup.$is('Found')(lookup('2026-10-31', '2026-10-30'))).toBe(true)
    expect(lookup('2026-11-01', '2026-10-30')).toStrictEqual(Lookup.NotYet())
  })

  test('rejects malformed dates and unscheduled days', () => {
    expect(lookup('2026-13-01', '2026-10-30')).toStrictEqual(
      Lookup.InvalidDate(),
    )
    expect(lookup('2026-10-29', '2026-10-30')).toStrictEqual(
      Lookup.Unscheduled(),
    )
  })
})
