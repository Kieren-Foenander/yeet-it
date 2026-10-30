/**
 * Puzzle supply pipeline. No manual selection: everything below is derived from the
 * pinned dictionary, the frequency export, and POLICY in src/generator/schedule.ts.
 *
 *   node scripts/puzzles.ts generate [--days 400] [--today YYYY-MM-DD]
 *   node scripts/puzzles.ts verify [--published old-schedule.json] [--min-buffer 180] [--today YYYY-MM-DD]
 *   node scripts/puzzles.ts analyze
 */
import { NodeRuntime, NodeServices } from '@effect/platform-node'
import {
  Array,
  Clock,
  Console,
  Data,
  Effect,
  Match,
  Option,
  pipe,
  Schema,
} from 'effect'
import { FileSystem } from 'effect/FileSystem'

import {
  addDays,
  type IsoDate,
  isValidIsoDate,
  utcDateOf,
} from '../src/game/day.ts'
import { lexiconOf } from '../src/generator/pool.ts'
import {
  bufferDays,
  difficultyOf,
  emptySchedule,
  extendSchedule,
  immutabilityProblems,
  POLICY,
  type Schedule,
  ScheduleJson,
} from '../src/generator/schedule.ts'
import {
  DICTIONARY_VERSION,
  FREQUENCY_VERSION,
  loadSources,
} from '../src/generator/sources.ts'
import {
  eligiblePool,
  payloadProblems,
  verifySchedule,
} from '../src/generator/verify.ts'

const SCHEDULE_PATH = 'data/schedule.json'

const DEFAULT_DAYS_AHEAD = 400

const DEFAULT_MINIMUM_BUFFER = 180

const LOW_POOL_WARNING_DAYS = 120

const VERSIONS = {
  dictionary: DICTIONARY_VERSION,
  frequency: FREQUENCY_VERSION,
}

class VerificationFailed extends Data.TaggedError('VerificationFailed')<{
  readonly problems: ReadonlyArray<string>
}> {}

class UsageError extends Data.TaggedError('UsageError')<{
  readonly detail: string
}> {}

const argv = process.argv.slice(2)

const option = (name: string): Option.Option<string> =>
  pipe(
    Array.findFirstIndex(argv, argument => argument === `--${name}`),
    Option.flatMap(index => Array.get(argv, index + 1)),
  )

const dateOption = (name: string) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis

    return yield* Option.match(option(name), {
      onNone: () => Effect.succeed(utcDateOf(now)),
      onSome: raw =>
        isValidIsoDate(raw)
          ? Effect.succeed(raw)
          : Effect.fail(
              new UsageError({ detail: `--${name} must be YYYY-MM-DD` }),
            ),
    })
  })

const integerOption = (name: string, fallback: number) =>
  Option.match(option(name), {
    onNone: () => Effect.succeed(fallback),
    onSome: raw =>
      /^\d+$/.test(raw)
        ? Effect.succeed(Number(raw))
        : Effect.fail(
            new UsageError({ detail: `--${name} must be a whole number` }),
          ),
  })

const readSchedule = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem

    if (!(yield* fs.exists(path))) {
      return Option.none<Schedule>()
    }

    return Option.some(
      yield* Schema.decodeEffect(ScheduleJson)(yield* fs.readFileString(path)),
    )
  })

const writeSchedule = (schedule: Schedule) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem

    const lines = Array.map(
      schedule.entries,
      entry => `    ${JSON.stringify(entry)}`,
    )

    yield* fs.writeFileString(
      SCHEDULE_PATH,
      `{\n  "format": ${JSON.stringify(schedule.format)},\n  "epoch": ${JSON.stringify(schedule.epoch)},\n  "entries": [\n${lines.join(',\n')}\n  ]\n}\n`,
    )
  })

const failOnProblems = (problems: ReadonlyArray<string>) =>
  Array.isReadonlyArrayNonEmpty(problems)
    ? Effect.fail(new VerificationFailed({ problems }))
    : Effect.void

const poolSummary = (schedule: Schedule, poolSize: number, today: IsoDate) =>
  Effect.gen(function* () {
    const unused =
      poolSize - new Set(Array.map(schedule.entries, entry => entry.start)).size

    yield* Console.log(
      `schedule: ${schedule.entries.length} entries, ${schedule.entries[0]?.date ?? '-'} → ${schedule.entries.at(-1)?.date ?? '-'}; buffer ${bufferDays(schedule, today)} days after ${today}`,
    )
    yield* Console.log(
      `pool: ${poolSize} eligible puzzles, ${unused} never scheduled`,
    )

    if (unused < LOW_POOL_WARNING_DAYS) {
      yield* Console.warn(
        `warning: fewer than ${LOW_POOL_WARNING_DAYS} unused puzzles remain; reuse after ${POLICY.reuseWindowDays} days will begin soon`,
      )
    }
  })

const loadLexicon = Effect.gen(function* () {
  const sources = yield* loadSources

  return {
    ...sources,
    lexicon: lexiconOf(sources.words, sources.frequencies),
  }
})

const generate = Effect.gen(function* () {
  const today = yield* dateOption('today')
  const days = yield* integerOption('days', DEFAULT_DAYS_AHEAD)
  const { lexicon } = yield* loadLexicon
  const pool = eligiblePool(lexicon, POLICY)

  const published = Option.getOrElse(
    yield* readSchedule(SCHEDULE_PATH),
    () => emptySchedule,
  )

  const result = extendSchedule(
    POLICY,
    published,
    pool,
    addDays(today, days),
    VERSIONS,
  )

  yield* failOnProblems([
    ...immutabilityProblems(published, result.schedule),
    ...verifySchedule(lexicon, POLICY, VERSIONS, result.schedule),
  ])

  if (Option.isSome(result.exhausted)) {
    return yield* result.exhausted.value
  }

  const added = result.schedule.entries.length - published.entries.length

  if (added > 0) {
    yield* writeSchedule(result.schedule)
  }

  yield* Console.log(`added ${added} entries`)
  yield* poolSummary(result.schedule, pool.length, today)
})

const verify = Effect.gen(function* () {
  const today = yield* dateOption('today')

  const minimumBuffer = yield* integerOption(
    'min-buffer',
    DEFAULT_MINIMUM_BUFFER,
  )

  const { lexicon, words } = yield* loadLexicon
  const schedule = yield* readSchedule(SCHEDULE_PATH)

  if (Option.isNone(schedule)) {
    return yield* new VerificationFailed({
      problems: [`${SCHEDULE_PATH} is missing`],
    })
  }

  const published = yield* Option.match(option('published'), {
    onNone: () => Effect.succeed(Option.none<Schedule>()),
    onSome: readSchedule,
  })

  const upcoming = schedule.value.entries.filter(
    entry =>
      entry.date >= addDays(today, -1) && entry.date <= addDays(today, 14),
  )

  yield* failOnProblems([
    ...Option.match(published, {
      onNone: () => [],
      onSome: previous => immutabilityProblems(previous, schedule.value),
    }),
    ...verifySchedule(lexicon, POLICY, VERSIONS, schedule.value),
    ...payloadProblems(lexicon, POLICY, words, upcoming),
    ...(bufferDays(schedule.value, today) >= minimumBuffer
      ? []
      : [
          `buffer is ${bufferDays(schedule.value, today)} days after ${today}; at least ${minimumBuffer} required`,
        ]),
  ])

  yield* Console.log(
    `verified ${schedule.value.entries.length} entries and ${upcoming.length} upcoming payloads`,
  )
  yield* poolSummary(
    schedule.value,
    eligiblePool(lexicon, POLICY).length,
    today,
  )
})

const analyze = Effect.gen(function* () {
  const { lexicon } = yield* loadLexicon
  const pool = eligiblePool(lexicon, POLICY)

  const tiers = Array.groupBy(pool, candidate =>
    difficultyOf(POLICY, candidate.metrics),
  )

  yield* Console.log(
    `nine-letter ENABLE words: ${lexicon.byLength[9]?.length ?? 0}`,
  )
  yield* Console.log(`eligible puzzles: ${pool.length}`)
  yield* Console.log(
    `by difficulty: easy ${tiers['easy']?.length ?? 0}, medium ${tiers['medium']?.length ?? 0}, hard ${tiers['hard']?.length ?? 0}`,
  )
})

const program = Match.value(argv[0]).pipe(
  Match.when('generate', () => generate),
  Match.when('verify', () => verify),
  Match.when('analyze', () => analyze),
  Match.orElse(() =>
    Effect.fail(
      new UsageError({
        detail: 'usage: puzzles.ts generate | verify | analyze',
      }),
    ),
  ),
  Effect.catchTag('VerificationFailed', error =>
    pipe(
      Console.error(
        `verification failed (${error.problems.length} problems):\n${error.problems.slice(0, 50).join('\n')}`,
      ),
      Effect.andThen(Effect.fail(error)),
    ),
  ),
)

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))
