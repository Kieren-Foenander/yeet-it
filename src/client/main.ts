import {
  Clock,
  Duration,
  Effect,
  Option,
  Random,
  Schema,
  Stream,
  String,
} from 'effect'
import { Command, Dom, Runtime, Subscription, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { IsoDate, msUntilNextUtcDay, utcDateOf } from '../game/day.ts'
import { normalizeWord, usedPositions } from '../game/letters.ts'
import { Puzzle } from '../game/puzzle.ts'
import { MoveVerdict } from '../game/rules.ts'
import {
  acceptedWordsOf,
  currentWord,
  finishRun,
  isFinished,
  restoreRun,
  type Run,
  shareText,
  startRun,
  submitWord,
} from '../game/run.ts'
import { recordFinish, type Stats } from '../game/stats.ts'
import { Message } from './message.ts'
import { Feedback, type Flags, Game, type Model, type Play } from './model.ts'
import { loadProgress, SavedProgress, saveProgress } from './storage.ts'

export const SHARE_TEXT_ID = 'share-text'

type UpdateReturn = Update.Return<Model, Message>

// FLAGS

export const flags: Effect.Effect<Flags> = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis
  const progress = yield* loadProgress

  return {
    today: utcDateOf(now),
    origin: window.location.origin,
    storage: progress.storage,
    stats: progress.stats,
    run: progress.run,
  }
})

// COMMAND

export const FetchPuzzle = Command.define('FetchPuzzle', {
  args: { date: IsoDate },
  messages: [Message.SucceededFetchPuzzle, Message.FailedFetchPuzzle],
  execute: ({ date }) =>
    Effect.tryPromise(() =>
      fetch(`/api/puzzle/${date}`).then(response =>
        response.ok ? response.text() : Promise.reject(response.status),
      ),
    ).pipe(
      Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Puzzle))),
      Effect.map(puzzle => Message.SucceededFetchPuzzle({ puzzle })),
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedFetchPuzzle({
            reason:
              'Today’s puzzle didn’t load. Check your connection and try again.',
          }),
        ),
      ),
    ),
})

export const ShuffleRack = Command.define('ShuffleRack', {
  args: { rack: Schema.String },
  messages: [Message.CompletedShuffleRack],
  execute: ({ rack }) =>
    Effect.map(Random.shuffle(rack.split('')), letters =>
      Message.CompletedShuffleRack({ rack: letters.join('') }),
    ),
})

export const SaveProgress = Command.define('SaveProgress', {
  args: { progress: SavedProgress },
  messages: [Message.SucceededSaveProgress, Message.FailedSaveProgress],
  execute: ({ progress }) =>
    saveProgress(progress).pipe(
      Effect.as(Message.SucceededSaveProgress()),
      Effect.catch(() => Effect.succeed(Message.FailedSaveProgress())),
    ),
})

const copyWithSelection = (text: string): boolean => {
  const area = document.createElement('textarea')

  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.append(area)
  area.select()

  const copied = document.execCommand('copy')

  area.remove()

  return copied
}

export const CopyResult = Command.define('CopyResult', {
  args: { text: Schema.String },
  messages: [Message.CompletedCopyResult],
  execute: ({ text }) =>
    Effect.tryPromise(() => navigator.clipboard.writeText(text)).pipe(
      Effect.as(true),
      Effect.catch(() => Effect.try(() => copyWithSelection(text))),
      Effect.catch(() => Effect.succeed(false)),
      Effect.map(copied => Message.CompletedCopyResult({ copied })),
    ),
})

export const SelectShareText = Command.define('SelectShareText', {
  messages: [Message.CompletedSelectShareText],
  execute: Dom.focus(`#${SHARE_TEXT_ID}`).pipe(
    Effect.andThen(
      Effect.sync(() => {
        const area = document.getElementById(SHARE_TEXT_ID)

        if (area instanceof HTMLTextAreaElement) {
          area.select()
        }
      }),
    ),
    Effect.ignore,
    Effect.as(Message.CompletedSelectShareText()),
  ),
})

// INIT

const loadDay = (
  model: Model,
  date: IsoDate,
  saved: Option.Option<Run>,
): UpdateReturn => ({
  model: modifyFields(model, {
    today: () => date,
    game: () => Game.Loading({ saved }),
    nextDay: () => Option.none(),
  }),
  commands: [FetchPuzzle({ date })],
})

export const init: Runtime.ApplicationInit<
  Model,
  Message,
  Flags
> = startFlags => ({
  model: {
    today: startFlags.today,
    origin: startFlags.origin,
    storage: startFlags.storage,
    stats: startFlags.stats,
    game: Game.Loading({ saved: startFlags.run }),
    nextDay: Option.none(),
  },
  commands: [FetchPuzzle({ date: startFlags.today })],
})

// UPDATE

const progressOf = (run: Run, stats: Stats): SavedProgress => ({
  version: 1,
  run: Option.some(run),
  stats,
})

const playOf = (model: Model): Option.Option<Play> =>
  Game.match(model.game, {
    Loading: () => Option.none(),
    Failed: () => Option.none(),
    Ready: ({ play }) => Option.some(play),
  })

const withPlay = (
  model: Model,
  transform: (play: Play) => UpdateReturn,
): UpdateReturn =>
  Option.match(playOf(model), {
    onNone: () => ({ model }),
    onSome: transform,
  })

const setPlay = (model: Model, play: Play): Model =>
  modifyFields(model, { game: () => Game.Ready({ play }) })

/** Commit a new run state: record a finish once, and persist. */
const commitRun = (
  model: Model,
  play: Play,
  run: Run,
  feedback: Feedback,
): UpdateReturn => {
  const stats =
    isFinished(run) && !isFinished(play.run)
      ? recordFinish(model.stats, run)
      : model.stats

  const rack =
    run.chain.length === play.run.chain.length ? play.rack : currentWord(run)

  return {
    model: modifyFields(
      setPlay(model, {
        ...play,
        run,
        rack,
        draft: '',
        feedback,
        finishPrompt: 'Idle',
      }),
      {
        stats: () => stats,
      },
    ),
    commands: [SaveProgress({ progress: progressOf(run, stats) })],
  }
}

const removeLetter = (draft: string, letter: string): string => {
  const index = draft.lastIndexOf(letter)

  return index < 0 ? draft : draft.slice(0, index) + draft.slice(index + 1)
}

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededFetchPuzzle: ({ puzzle }) => {
      const saved = Game.match(model.game, {
        Loading: ({ saved }) => saved,
        Failed: () => Option.none<Run>(),
        Ready: () => Option.none<Run>(),
      })

      const run = Option.getOrElse(
        Option.flatMap(saved, savedRun => restoreRun(savedRun, puzzle)),
        () => startRun(puzzle),
      )

      const stats = isFinished(run)
        ? recordFinish(model.stats, run)
        : model.stats

      return {
        model: modifyFields(
          setPlay(model, {
            puzzle,
            run,
            draft: '',
            rack: currentWord(run),
            feedback: Feedback.Idle(),
            finishPrompt: 'Idle',
            copy: 'Idle',
          }),
          { stats: () => stats },
        ),
      }
    },

    FailedFetchPuzzle: ({ reason }) => ({
      model: modifyFields(model, { game: () => Game.Failed({ reason }) }),
    }),

    ClickedRetry: () => loadDay(model, model.today, Option.none()),

    UpdatedDraft: ({ value }) =>
      withPlay(model, play => ({
        model: setPlay(model, {
          ...play,
          draft: String.slice(0, play.rack.length)(normalizeWord(value)),
          feedback: Feedback.Idle(),
        }),
      })),

    ClickedTile: ({ index }) =>
      withPlay(model, play => {
        const letter = play.rack[index] ?? ''
        const isUsed = usedPositions(play.rack, play.draft)[index] ?? false

        return {
          model: setPlay(model, {
            ...play,
            draft: isUsed
              ? removeLetter(play.draft, letter)
              : play.draft + letter,
            feedback: Feedback.Idle(),
          }),
        }
      }),

    ClickedBackspace: () =>
      withPlay(model, play => ({
        model: setPlay(model, {
          ...play,
          draft: play.draft.slice(0, -1),
          feedback: Feedback.Idle(),
        }),
      })),

    ClickedClear: () =>
      withPlay(model, play => ({
        model: setPlay(model, {
          ...play,
          draft: '',
          feedback: Feedback.Idle(),
        }),
      })),

    ClickedShuffle: () =>
      withPlay(model, play => ({
        model,
        commands: [ShuffleRack({ rack: play.rack })],
      })),

    CompletedShuffleRack: ({ rack }) =>
      withPlay(model, play => ({
        model:
          rack.length === play.rack.length
            ? setPlay(model, { ...play, rack })
            : model,
      })),

    SubmittedDraft: () =>
      withPlay(model, play => {
        const submitted = submitWord(
          play.run,
          play.puzzle,
          acceptedWordsOf(play.puzzle),
          play.draft,
        )

        const rejected = (): UpdateReturn => ({
          model: setPlay(model, {
            ...play,
            feedback: Feedback.Rejected({ verdict: submitted.verdict }),
          }),
        })

        return MoveVerdict.match(submitted.verdict, {
          Valid: ({ removed }) =>
            commitRun(
              model,
              play,
              submitted.run,
              Feedback.Banked({ word: play.draft, removed }),
            ),
          Empty: () => ({ model }),
          UsesMissingLetters: rejected,
          TooShort: rejected,
          NotShorter: rejected,
          NotAWord: rejected,
        })
      }),

    ClickedFinish: () =>
      withPlay(model, play => ({
        model: setPlay(model, { ...play, finishPrompt: 'Confirming' }),
      })),

    ClickedCancelFinish: () =>
      withPlay(model, play => ({
        model: setPlay(model, { ...play, finishPrompt: 'Idle' }),
      })),

    ClickedConfirmFinish: () =>
      withPlay(model, play =>
        commitRun(model, play, finishRun(play.run), Feedback.Idle()),
      ),

    ClickedCopy: () =>
      withPlay(model, play => ({
        model,
        commands: [CopyResult({ text: shareText(play.run, model.origin) })],
      })),

    CompletedCopyResult: ({ copied }) =>
      withPlay(model, play =>
        copied
          ? { model: setPlay(model, { ...play, copy: 'Copied' }) }
          : {
              model: setPlay(model, { ...play, copy: 'Manual' }),
              commands: [SelectShareText()],
            },
      ),

    CompletedSelectShareText: () => ({ model }),

    SucceededSaveProgress: () => ({
      model: modifyFields(model, { storage: () => 'Available' }),
    }),

    FailedSaveProgress: () => ({
      model: modifyFields(model, { storage: () => 'Unavailable' }),
    }),

    ReachedNewDay: ({ date }) => {
      if (date <= model.today) {
        return { model }
      }

      const isMidRun = Option.match(playOf(model), {
        onNone: () => false,
        onSome: play => !isFinished(play.run) && play.run.chain.length > 0,
      })

      return isMidRun
        ? { model: modifyFields(model, { nextDay: () => Option.some(date) }) }
        : loadDay(model, date, Option.none())
    },

    ClickedPlayToday: () =>
      Option.match(model.nextDay, {
        onNone: () => ({ model }),
        onSome: date => loadDay(model, date, Option.none()),
      }),
  })

// SUBSCRIPTION

const currentDate = Effect.map(Clock.currentTimeMillis, utcDateOf)

const untilNextDay = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis

  yield* Effect.sleep(Duration.millis(msUntilNextUtcDay(now) + 1000))

  return yield* currentDate
})

export const subscriptions = Subscription.make<Model, Message>()(entry => ({
  dayRollover: entry(
    { today: IsoDate },
    {
      modelToDependencies: model => ({ today: model.today }),
      dependenciesToStream: ({ today }) =>
        Stream.merge(
          Stream.fromEffect(untilNextDay),
          Stream.fromEventListener(document, 'visibilitychange').pipe(
            Stream.mapEffect(() => currentDate),
          ),
        ).pipe(
          Stream.filter(date => date > today),
          Stream.map(date => Message.ReachedNewDay({ date })),
        ),
    },
  ),
}))
