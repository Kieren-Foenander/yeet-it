import { Data, Effect, Option, Schema } from 'effect'

import { Run } from '../game/run.ts'
import { emptyStats, Stats } from '../game/stats.ts'

const PROGRESS_KEY = 'yeet-it:progress'

const PROBE_KEY = 'yeet-it:probe'

/** Everything this device remembers. Bump `version` (and migrate) when the shape changes. */
export const SavedProgress = Schema.Struct({
  version: Schema.Literal(1),
  run: Schema.Option(Run),
  stats: Stats,
})

export type SavedProgress = typeof SavedProgress.Type

const SavedProgressJson = Schema.fromJsonString(
  Schema.toCodecJson(SavedProgress),
)

export const StorageStatus = Schema.Literals(['Available', 'Unavailable'])

export type StorageStatus = typeof StorageStatus.Type

export const LoadedProgress = Schema.Struct({
  storage: StorageStatus,
  run: Schema.Option(Run),
  stats: Stats,
})

export type LoadedProgress = typeof LoadedProgress.Type

class StorageFailure extends Data.TaggedError('StorageFailure')<{
  readonly cause: Error
}> {}

const toFailure = (cause: Error) => new StorageFailure({ cause })

/** localStorage throws in some private modes and when blocked; every access goes through here. */
const withStorage = <A>(use: (storage: Storage) => A) =>
  Effect.try({
    try: () => use(window.localStorage),
    catch: cause =>
      toFailure(
        cause instanceof Error ? cause : new Error('storage unavailable'),
      ),
  })

const probe = withStorage(storage => {
  storage.setItem(PROBE_KEY, '1')
  storage.removeItem(PROBE_KEY)
})

const readSaved = withStorage(storage => storage.getItem(PROGRESS_KEY)).pipe(
  Effect.flatMap(raw => Effect.fromOption(Option.fromNullishOr(raw))),
  Effect.flatMap(Schema.decodeEffect(SavedProgressJson)),
)

/**
 * Read saved progress. Unavailable storage (private modes, blocked cookies) and
 * corrupt or outdated records never stop play: they fall back to a fresh start.
 */
export const loadProgress: Effect.Effect<LoadedProgress> = Effect.gen(
  function* () {
    const storage = yield* probe.pipe(
      Effect.as<StorageStatus>('Available'),
      Effect.catch(() => Effect.succeed<StorageStatus>('Unavailable')),
    )

    const saved = yield* readSaved.pipe(
      Effect.map(Option.some),
      Effect.catch(() => Effect.succeed(Option.none<SavedProgress>())),
    )

    return Option.match(saved, {
      onNone: () => ({ storage, run: Option.none(), stats: emptyStats }),
      onSome: progress => ({
        storage,
        run: progress.run,
        stats: progress.stats,
      }),
    })
  },
)

export const saveProgress = (progress: SavedProgress) =>
  Schema.encodeEffect(SavedProgressJson)(progress).pipe(
    Effect.flatMap(encoded =>
      withStorage(storage => storage.setItem(PROGRESS_KEY, encoded)),
    ),
  )
