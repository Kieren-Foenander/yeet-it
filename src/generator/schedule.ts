import { Array, Data, Match, Option, Order, pipe, Schema } from 'effect'

import {
  addDays,
  daysBetween,
  EPOCH_DATE,
  IsoDate,
  puzzleNumberOf,
  utcWeekday,
} from '../game/day.ts'
import { fitsWithin, multisetKey } from '../game/letters.ts'
import { UppercaseWord } from '../game/puzzle.ts'
import { MINIMUM_LENGTH, START_LENGTH } from '../game/rules.ts'
import type { Candidate, CandidateMetrics, FamiliarityPolicy } from './pool.ts'

export const SCHEDULE_FORMAT = 'yeet-it.schedule/v1'

export const GENERATOR_VERSION = 'yeet-it-generator/1'

export const Difficulty = Schema.Literals(['easy', 'medium', 'hard'])

export type Difficulty = typeof Difficulty.Type

export const Metrics = Schema.Struct({
  startFrequency: Schema.Int,
  acceptedWords: Schema.Int,
  familiarWords: Schema.Int,
  acceptedFirstMoves: Schema.Int,
  familiarFirstMoves: Schema.Int,
  winningFirstMoves: Schema.Int,
  firstMoveRetention: Schema.Number,
  fullRoutes: Schema.Int,
})

export const Entry = Schema.Struct({
  number: Schema.Int,
  date: IsoDate,
  start: UppercaseWord,
  route: Schema.Array(UppercaseWord),
  difficulty: Difficulty,
  metrics: Metrics,
  generator: Schema.String,
  dictionary: Schema.String,
  frequency: Schema.String,
})

export type Entry = typeof Entry.Type

export const Schedule = Schema.Struct({
  format: Schema.Literal(SCHEDULE_FORMAT),
  epoch: IsoDate,
  entries: Schema.Array(Entry),
})

export type Schedule = typeof Schedule.Type

export const ScheduleJson = Schema.fromJsonString(Schema.toCodecJson(Schedule))

export type SchedulePolicy = Readonly<{
  familiarity: FamiliarityPolicy
  /** A start multiset is not reused within this many days. */
  reuseWindowDays: number
  /** The guaranteed route's eight-letter word is not reused within this many days. */
  openingWindowDays: number
  /** Full familiar routes at or above which a puzzle is easy. */
  easyMinimumRoutes: number
  /** Full familiar routes below which a puzzle is hard. */
  hardMaximumRoutes: number
}>

export const POLICY: SchedulePolicy = {
  familiarity: {
    startMinimum: 250,
    routeMinimumByLength: { 3: 400, 4: 350, 5: 325, 6: 300, 7: 275, 8: 250 },
    minimumFamiliarFirstMoves: 1,
    minimumFirstMoveRetention: 0.5,
  },
  reuseWindowDays: 730,
  openingWindowDays: 30,
  easyMinimumRoutes: 500,
  hardMaximumRoutes: 60,
}

/** Monday → Sunday. Easier early in the week, harder towards the weekend. */
const WEEKLY_DIFFICULTY: ReadonlyArray<Difficulty> = [
  'easy',
  'easy',
  'medium',
  'medium',
  'hard',
  'hard',
  'medium',
]

export const difficultyOf = (
  policy: SchedulePolicy,
  metrics: CandidateMetrics,
): Difficulty =>
  Match.value(metrics.fullRoutes).pipe(
    Match.when(
      routes => routes >= policy.easyMinimumRoutes,
      (): Difficulty => 'easy',
    ),
    Match.when(
      routes => routes < policy.hardMaximumRoutes,
      (): Difficulty => 'hard',
    ),
    Match.orElse((): Difficulty => 'medium'),
  )

const fallbackOrder = (target: Difficulty): ReadonlyArray<Difficulty> =>
  Match.value(target).pipe(
    Match.when('easy', (): ReadonlyArray<Difficulty> => [
      'easy',
      'medium',
      'hard',
    ]),
    Match.when('medium', (): ReadonlyArray<Difficulty> => [
      'medium',
      'easy',
      'hard',
    ]),
    Match.when('hard', (): ReadonlyArray<Difficulty> => [
      'hard',
      'medium',
      'easy',
    ]),
    Match.exhaustive,
  )

/** FNV-1a: a stable, dependency-free ordering key so selection is reproducible from the inputs alone. */
export const stableHash = (text: string): number =>
  text
    .split('')
    .reduce(
      (hash, character) =>
        Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0,
      0x811c9dc5,
    )

export type Versions = Readonly<{ dictionary: string; frequency: string }>

export class ScheduleExhaustedError extends Data.TaggedError(
  'ScheduleExhaustedError',
)<{ readonly date: IsoDate; readonly detail: string }> {}

const recentEntries = (
  entries: ReadonlyArray<Entry>,
  date: IsoDate,
  windowDays: number,
): ReadonlyArray<Entry> =>
  entries.filter(entry => {
    const age = daysBetween(entry.date, date)

    return age > 0 && age <= windowDays
  })

const pickFor = (
  policy: SchedulePolicy,
  pool: ReadonlyArray<Candidate>,
  entries: ReadonlyArray<Entry>,
  date: IsoDate,
): Option.Option<
  Readonly<{ candidate: Candidate; difficulty: Difficulty }>
> => {
  const usedStarts = new Set(
    Array.map(recentEntries(entries, date, policy.reuseWindowDays), entry =>
      multisetKey(entry.start),
    ),
  )

  const recentOpenings = new Set(
    recentEntries(entries, date, policy.openingWindowDays).flatMap(entry =>
      Array.take(entry.route, 1),
    ),
  )

  const available = pool.filter(
    candidate =>
      !usedStarts.has(multisetKey(candidate.metrics.word)) &&
      !Array.take(candidate.route, 1).some(opening =>
        recentOpenings.has(opening),
      ),
  )

  const byHash = Order.mapInput(Order.Number, (candidate: Candidate) =>
    stableHash(`${date}:${candidate.metrics.word}`),
  )

  return pipe(
    fallbackOrder(WEEKLY_DIFFICULTY[utcWeekday(date)] ?? 'medium'),
    Array.findFirst(difficulty =>
      pipe(
        available.filter(
          candidate => difficultyOf(policy, candidate.metrics) === difficulty,
        ),
        Array.sort(byHash),
        Array.head,
        Option.map(candidate => ({ candidate, difficulty })),
      ),
    ),
  )
}

export const entryFor = (
  date: IsoDate,
  candidate: Candidate,
  difficulty: Difficulty,
  versions: Versions,
): Entry => ({
  number: puzzleNumberOf(date),
  date,
  start: candidate.metrics.word,
  route: candidate.route,
  difficulty,
  metrics: {
    startFrequency: candidate.metrics.startFrequency,
    acceptedWords: candidate.metrics.acceptedWords,
    familiarWords: candidate.metrics.familiarWords,
    acceptedFirstMoves: candidate.metrics.acceptedFirstMoves,
    familiarFirstMoves: candidate.metrics.familiarFirstMoves,
    winningFirstMoves: candidate.metrics.winningFirstMoves,
    firstMoveRetention:
      Math.round(candidate.metrics.firstMoveRetention * 1000) / 1000,
    fullRoutes: candidate.metrics.fullRoutes,
  },
  generator: GENERATOR_VERSION,
  dictionary: versions.dictionary,
  frequency: versions.frequency,
})

export const emptySchedule: Schedule = {
  format: SCHEDULE_FORMAT,
  epoch: EPOCH_DATE,
  entries: [],
}

export const lastScheduledDate = (schedule: Schedule): Option.Option<IsoDate> =>
  Option.map(Array.last(schedule.entries), entry => entry.date)

/**
 * Append entries until the schedule covers `through`. Published entries are never
 * touched: the result's entries start with exactly the input's entries.
 */
export const extendSchedule = (
  policy: SchedulePolicy,
  schedule: Schedule,
  pool: ReadonlyArray<Candidate>,
  through: IsoDate,
  versions: Versions,
): Readonly<{
  schedule: Schedule
  exhausted: Option.Option<ScheduleExhaustedError>
}> => {
  const firstDate = Option.match(lastScheduledDate(schedule), {
    onNone: () => schedule.epoch,
    onSome: last => addDays(last, 1),
  })

  const count = Math.max(0, daysBetween(firstDate, through) + 1)

  return Array.reduce(
    count > 0 ? Array.makeBy(count, offset => addDays(firstDate, offset)) : [],
    { schedule, exhausted: Option.none<ScheduleExhaustedError>() },
    (state, date) => {
      if (Option.isSome(state.exhausted)) {
        return state
      }

      return Option.match(pickFor(policy, pool, state.schedule.entries, date), {
        onNone: () => ({
          schedule: state.schedule,
          exhausted: Option.some(
            new ScheduleExhaustedError({
              date,
              detail: 'no eligible puzzle remains outside the reuse windows',
            }),
          ),
        }),
        onSome: ({ candidate, difficulty }) => ({
          schedule: {
            ...state.schedule,
            entries: [
              ...state.schedule.entries,
              entryFor(date, candidate, difficulty, versions),
            ],
          },
          exhausted: state.exhausted,
        }),
      })
    },
  )
}

export type Problem = string

/** Checks that do not need the dictionary: shape, dates, numbering, route arithmetic, reuse windows. */
export const structuralProblems = (
  policy: SchedulePolicy,
  schedule: Schedule,
): ReadonlyArray<Problem> =>
  schedule.entries.flatMap((entry, index) => {
    const expectedDate = addDays(schedule.epoch, index)

    const routeProblems = entry.route.flatMap((word, step) => {
      const previous = step === 0 ? entry.start : (entry.route[step - 1] ?? '')

      return word.length === START_LENGTH - 1 - step &&
        fitsWithin(word, previous)
        ? []
        : [
            `${entry.date}: route word ${word} is not ${previous} minus one letter`,
          ]
    })

    const reuse = recentEntries(
      schedule.entries.slice(0, index),
      entry.date,
      policy.reuseWindowDays,
    ).filter(earlier => multisetKey(earlier.start) === multisetKey(entry.start))

    return [
      ...(entry.date === expectedDate
        ? []
        : [`entry ${index}: date ${entry.date}, expected ${expectedDate}`]),
      ...(entry.number === puzzleNumberOf(entry.date) &&
      entry.number === index + 1
        ? []
        : [`${entry.date}: number ${entry.number}, expected ${index + 1}`]),
      ...(entry.start.length === START_LENGTH
        ? []
        : [`${entry.date}: start ${entry.start} is not nine letters`]),
      ...(entry.route.length === START_LENGTH - MINIMUM_LENGTH
        ? []
        : [`${entry.date}: route has ${entry.route.length} words, expected 6`]),
      ...routeProblems,
      ...Array.map(
        reuse,
        earlier =>
          `${entry.date}: reuses ${earlier.date}'s letters (${earlier.start})`,
      ),
    ]
  })

/** Published entries must survive every rebuild unchanged. */
export const immutabilityProblems = (
  published: Schedule,
  next: Schedule,
): ReadonlyArray<Problem> => [
  ...(published.epoch === next.epoch
    ? []
    : [`epoch changed from ${published.epoch} to ${next.epoch}`]),
  ...published.entries.flatMap((entry, index) => {
    const replacement = next.entries[index]

    return replacement !== undefined &&
      JSON.stringify(replacement) === JSON.stringify(entry)
      ? []
      : [
          `published entry ${entry.date} (#${entry.number}) was changed or removed`,
        ]
  }),
]

export const bufferDays = (schedule: Schedule, today: IsoDate): number =>
  Option.match(lastScheduledDate(schedule), {
    onNone: () => 0,
    onSome: last => Math.max(0, daysBetween(today, last)),
  })
