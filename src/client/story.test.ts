import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { ballrooms } from '../game/fixtures.ts'
import {
  acceptedWordsOf,
  finishRun,
  isFinished,
  type Run,
  startRun,
  submitWord,
} from '../game/run.ts'
import { emptyStats } from '../game/stats.ts'
import {
  CopyResult,
  FetchPuzzle,
  SaveProgress,
  SelectShareText,
  update,
} from './main.ts'
import { Message } from './message.ts'
import { Feedback, Game, type Model, type Play } from './model.ts'

const play = (words: ReadonlyArray<string>): Run =>
  words.reduce(
    (run, word) =>
      submitWord(run, ballrooms, acceptedWordsOf(ballrooms), word).run,
    startRun(ballrooms),
  )

const loading = (saved: Option.Option<Run>): Model => ({
  today: ballrooms.date,
  origin: 'https://yeet.test',
  storage: 'Available',
  stats: emptyStats,
  game: Game.Loading({ saved }),
  nextDay: Option.none(),
})

const ready = (run: Run, draft = ''): Model => ({
  ...loading(Option.none()),
  game: Game.Ready({
    play: {
      puzzle: ballrooms,
      run,
      draft,
      rack: run.chain.at(-1)?.word ?? run.start,
      feedback: Feedback.Idle(),
      finishPrompt: 'Idle',
      copy: 'Idle',
    },
  }),
})

const playOf = (current: Model): Play =>
  Game.match(current.game, {
    Loading: () => expect.unreachable('still loading'),
    Failed: () => expect.unreachable('failed'),
    Ready: ({ play: ready_ }) => ready_,
  })

describe('loading a day', () => {
  test("restores today's saved run", () => {
    const saved = play(['BROOMS', 'BROOM'])

    story(
      update,
      given(loading(Option.some(saved))),
      message(Message.SucceededFetchPuzzle({ puzzle: ballrooms })),
      model(current => {
        expect(playOf(current).run).toStrictEqual(saved)
        expect(playOf(current).rack).toBe('BROOM')
      }),
    )
  })

  test("starts fresh instead of applying yesterday's letters", () => {
    const yesterday = { ...play(['BROOMS']), date: '2026-11-04', number: 6 }

    story(
      update,
      given(loading(Option.some(yesterday))),
      message(Message.SucceededFetchPuzzle({ puzzle: ballrooms })),
      model(current => {
        expect(playOf(current).run).toStrictEqual(startRun(ballrooms))
      }),
    )
  })

  test('offers a retry when the puzzle cannot load', () => {
    story(
      update,
      given(loading(Option.none())),
      message(Message.FailedFetchPuzzle({ reason: 'offline' })),
      model(current => {
        expect(current.game).toStrictEqual(Game.Failed({ reason: 'offline' }))
      }),
      message(Message.ClickedRetry()),
      Command.expectHas(FetchPuzzle),
      Command.resolve(
        FetchPuzzle,
        Message.SucceededFetchPuzzle({ puzzle: ballrooms }),
      ),
      model(current => {
        expect(playOf(current).run.chain).toHaveLength(0)
      }),
    )
  })
})

describe('playing', () => {
  test('tapping builds a draft and tapping a used tile takes it back', () => {
    story(
      update,
      given(ready(startRun(ballrooms))),
      message(Message.ClickedTile({ index: 0 })),
      message(Message.ClickedTile({ index: 4 })),
      message(Message.ClickedTile({ index: 0 })),
      model(current => {
        expect(playOf(current).draft).toBe('R')
      }),
    )
  })

  test('typed input is uppercased, stripped, and capped at the rack length', () => {
    story(
      update,
      given(ready(play(['BROOMS']))),
      message(Message.UpdatedDraft({ value: 'br-oom 5sx' })),
      model(current => {
        expect(playOf(current).draft).toBe('BROOMS')
      }),
    )
  })

  test('a valid word is banked and saved', () => {
    story(
      update,
      given(ready(startRun(ballrooms), 'BROOMS')),
      message(Message.SubmittedDraft()),
      Command.expectHas(SaveProgress),
      model(current => {
        expect(playOf(current).run.chain).toHaveLength(1)
        expect(playOf(current).draft).toBe('')
        expect(playOf(current).feedback).toStrictEqual(
          Feedback.Banked({ word: 'BROOMS', removed: ['A', 'L', 'L'] }),
        )
      }),
      Command.resolve(SaveProgress, Message.SucceededSaveProgress()),
    )
  })

  test('an invalid word costs nothing and saves nothing', () => {
    story(
      update,
      given(ready(startRun(ballrooms), 'BLAMS')),
      message(Message.SubmittedDraft()),
      Command.expectNone(),
      model(current => {
        expect(playOf(current).run.chain).toHaveLength(0)
        expect(playOf(current).draft).toBe('BLAMS')
      }),
    )
  })

  test('reaching three letters finishes the run and records the streak once', () => {
    story(
      update,
      given(ready(play(['BALLROOM', 'BROOM', 'BOOM']), 'MOB')),
      message(Message.SubmittedDraft()),
      Command.resolve(SaveProgress, Message.SucceededSaveProgress()),
      model(current => {
        expect(isFinished(playOf(current).run)).toBe(true)
        expect(current.stats.played).toBe(1)
        expect(current.stats.currentStreak).toBe(1)
      }),
    )
  })

  test('finishing early needs confirmation', () => {
    story(
      update,
      given(ready(play(['BROOMS']))),
      message(Message.ClickedFinish()),
      Command.expectNone(),
      message(Message.ClickedCancelFinish()),
      model(current => {
        expect(isFinished(playOf(current).run)).toBe(false)
      }),
      message(Message.ClickedFinish()),
      message(Message.ClickedConfirmFinish()),
      Command.resolve(SaveProgress, Message.SucceededSaveProgress()),
      model(current => {
        expect(isFinished(playOf(current).run)).toBe(true)
        expect(current.stats.played).toBe(1)
      }),
    )
  })

  test('a failed save is surfaced without blocking play', () => {
    story(
      update,
      given(ready(startRun(ballrooms), 'BROOMS')),
      message(Message.SubmittedDraft()),
      Command.resolve(SaveProgress, Message.FailedSaveProgress()),
      model(current => {
        expect(current.storage).toBe('Unavailable')
        expect(playOf(current).run.chain).toHaveLength(1)
      }),
    )
  })
})

describe('sharing', () => {
  test('falls back to a selected manual-copy field when the clipboard is blocked', () => {
    story(
      update,
      given(ready(finishRun(play(['BROOMS'])))),
      message(Message.ClickedCopy()),
      Command.resolve(
        CopyResult,
        Message.CompletedCopyResult({ copied: false }),
      ),
      Command.resolve(SelectShareText, Message.CompletedSelectShareText()),
      model(current => {
        expect(playOf(current).copy).toBe('Manual')
      }),
    )
  })
})

describe('midnight UTC', () => {
  test('loads the new puzzle immediately when no run is in progress', () => {
    story(
      update,
      given(ready(finishRun(play(['BROOMS'])))),
      message(Message.ReachedNewDay({ date: '2026-11-06' })),
      Command.expectHas(FetchPuzzle),
      model(current => {
        expect(current.today).toBe('2026-11-06')
        expect(current.game).toStrictEqual(
          Game.Loading({ saved: Option.none() }),
        )
      }),
      Command.resolve(
        FetchPuzzle,
        Message.FailedFetchPuzzle({ reason: 'offline' }),
      ),
    )
  })

  test("lets a mid-run player finish yesterday's run before switching", () => {
    story(
      update,
      given(ready(play(['BROOMS']))),
      message(Message.ReachedNewDay({ date: '2026-11-06' })),
      Command.expectNone(),
      model(current => {
        expect(current.nextDay).toStrictEqual(Option.some('2026-11-06'))
        expect(current.today).toBe(ballrooms.date)
      }),
      message(Message.ClickedPlayToday()),
      Command.resolve(
        FetchPuzzle,
        Message.FailedFetchPuzzle({ reason: 'offline' }),
      ),
      model(current => {
        expect(current.today).toBe('2026-11-06')
        expect(current.nextDay).toStrictEqual(Option.none())
      }),
    )
  })

  test('ignores a stale or repeated day signal', () => {
    story(
      update,
      given(ready(startRun(ballrooms))),
      message(Message.ReachedNewDay({ date: ballrooms.date })),
      Command.expectNone(),
      model(current => {
        expect(current.today).toBe(ballrooms.date)
      }),
    )
  })
})
