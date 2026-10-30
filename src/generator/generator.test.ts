import { readFileSync } from 'node:fs'

import { Array, Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import { addDays, puzzleNumberOf } from '../game/day.ts'
import { fitsWithin, multisetKey } from '../game/letters.ts'
import {
  evaluateCandidate,
  isFamiliar,
  lexiconOf,
  meetsPolicy,
  startCandidates,
} from './pool.ts'
import {
  emptySchedule,
  extendSchedule,
  immutabilityProblems,
  POLICY,
  type Schedule,
  ScheduleJson,
  structuralProblems,
} from './schedule.ts'
import {
  DICTIONARY_VERSION,
  ENABLE_SHA256,
  FREQUENCY_VERSION,
  parseEnable,
  parseFrequencies,
  sha256,
} from './sources.ts'
import { eligiblePool, payloadProblems, verifySchedule } from './verify.ts'

const versions = { dictionary: 'test', frequency: 'test' }

const tiny = lexiconOf(
  [
    'RELATIONS',
    'ORIENTALS',
    'RELATION',
    'ORIENTAL',
    'RETINAL',
    'RETAIL',
    'LATER',
    'REAL',
    'ARE',
    'TOILERS',
    'TOILER',
    'OILS',
    'TONSIL',
  ],
  new Map([
    ['RELATIONS', 450],
    ['ORIENTALS', 260],
    ['RELATION', 400],
    ['ORIENTAL', 400],
    ['RETINAL', 300],
    ['RETAIL', 400],
    ['LATER', 500],
    ['REAL', 500],
    ['ARE', 600],
    ['TOILERS', 100],
    ['TONSIL', 300],
  ]),
)

describe('candidate evaluation', () => {
  test('proves a familiar six-step route and measures openings', () => {
    const candidate = evaluateCandidate(tiny, POLICY.familiarity, 'RELATIONS')

    expect(candidate.route).toStrictEqual([
      'ORIENTAL',
      'RETINAL',
      'RETAIL',
      'LATER',
      'REAL',
      'ARE',
    ])
    expect(candidate.metrics.familiarFirstMoves).toBe(2)
    expect(candidate.metrics.winningFirstMoves).toBe(2)
    expect(candidate.metrics.fullRoutes).toBe(2)
    expect(meetsPolicy(POLICY.familiarity, candidate.metrics)).toBe(true)
  })

  test('rejects a start whose only routes need unfamiliar words', () => {
    const unfamiliar = lexiconOf(
      ['RELATIONS', 'RELATION', 'RETINAL', 'RETAIL', 'LATER', 'REAL', 'ARE'],
      new Map([['RELATIONS', 450]]),
    )

    const candidate = evaluateCandidate(
      unfamiliar,
      POLICY.familiarity,
      'RELATIONS',
    )

    expect(candidate.metrics.fullRoutes).toBe(0)
    expect(candidate.route).toStrictEqual([])
    expect(meetsPolicy(POLICY.familiarity, candidate.metrics)).toBe(false)
  })

  test('keeps one representative per nine-letter multiset', () => {
    expect(startCandidates(tiny, POLICY.familiarity)).toStrictEqual([
      'RELATIONS',
    ])
  })
})

describe('schedule', () => {
  const pool = eligiblePool(tiny, POLICY)

  test('appends dated, numbered entries and never reuses letters inside the window', () => {
    const result = extendSchedule(
      POLICY,
      emptySchedule,
      pool,
      emptySchedule.epoch,
      versions,
    )

    expect(result.schedule.entries).toHaveLength(1)
    expect(result.schedule.entries[0]?.number).toBe(1)

    const next = extendSchedule(
      POLICY,
      result.schedule,
      pool,
      addDays(emptySchedule.epoch, 1),
      versions,
    )

    expect(next.schedule.entries).toHaveLength(1)
    expect(Option.isSome(next.exhausted)).toBe(true)
  })

  test('is a no-op when the buffer already covers the target date', () => {
    const once = extendSchedule(
      POLICY,
      emptySchedule,
      pool,
      emptySchedule.epoch,
      versions,
    )

    const again = extendSchedule(
      POLICY,
      once.schedule,
      pool,
      emptySchedule.epoch,
      versions,
    )

    expect(again.schedule).toStrictEqual(once.schedule)
  })

  test('detects edits to published entries', () => {
    const published = extendSchedule(
      POLICY,
      emptySchedule,
      pool,
      emptySchedule.epoch,
      versions,
    ).schedule

    const edited: Schedule = {
      ...published,
      entries: Array.map(published.entries, entry => ({
        ...entry,
        start: 'ORIENTALS',
      })),
    }

    expect(immutabilityProblems(published, edited)).toHaveLength(1)
    expect(
      immutabilityProblems(published, { ...published, entries: [] }),
    ).toHaveLength(1)
  })

  test('flags routes that skip a length', () => {
    const published = extendSchedule(
      POLICY,
      emptySchedule,
      pool,
      emptySchedule.epoch,
      versions,
    ).schedule

    const broken: Schedule = {
      ...published,
      entries: Array.map(published.entries, entry => ({
        ...entry,
        route: ['ORIENTAL', 'RETAIL', 'LATER', 'REAL', 'ARE'],
      })),
    }

    expect(structuralProblems(POLICY, broken).length).toBeGreaterThan(0)
  })
})

describe('published schedule (real data)', () => {
  const enable = readFileSync('data/enable/enable1.txt', 'utf8')
  const words = parseEnable(enable)

  const lexicon = lexiconOf(
    words,
    parseFrequencies(readFileSync('data/wordfreq/enable-zipf-en.tsv', 'utf8')),
  )

  const schedule = Schema.decodeUnknownSync(ScheduleJson)(
    readFileSync('data/schedule.json', 'utf8'),
  )

  test('uses the pinned dictionary snapshot', () => {
    expect(sha256(enable)).toBe(ENABLE_SHA256)
    expect(words).toHaveLength(105_145)
  })

  test('every entry has a familiar 8→3 route, one letter per step', () => {
    schedule.entries.forEach(entry => {
      expect(entry.route.map(word => word.length)).toStrictEqual([
        8, 7, 6, 5, 4, 3,
      ])
      entry.route.forEach((word, step) => {
        expect(
          fitsWithin(
            word,
            step === 0 ? entry.start : (entry.route[step - 1] ?? ''),
          ),
        ).toBe(true)
        expect(lexicon.accepted.has(word)).toBe(true)
        expect(isFamiliar(lexicon, POLICY.familiarity, word)).toBe(true)
      })
      expect(entry.number).toBe(puzzleNumberOf(entry.date))
    })
  })

  test('never repeats a starting multiset', () => {
    const keys = schedule.entries.map(entry => multisetKey(entry.start))

    expect(new Set(keys).size).toBe(keys.length)
  })

  test('passes full verification against a fresh solver run', () => {
    expect(
      verifySchedule(
        lexicon,
        POLICY,
        { dictionary: DICTIONARY_VERSION, frequency: FREQUENCY_VERSION },
        schedule,
      ),
    ).toStrictEqual([])
  })

  test('the Worker publishes exactly the generator word list', () => {
    expect(
      payloadProblems(lexicon, POLICY, words, schedule.entries.slice(0, 7)),
    ).toStrictEqual([])
  })
})
