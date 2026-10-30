import { Effect, Schema } from 'effect'
import { Command, Runtime, type Update } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import { IsoDate, utcDateOf } from '../game/day.ts'
import { normalizeWord, usedPositions } from '../game/letters.ts'
import { Puzzle } from '../game/puzzle.ts'
import { MoveVerdict } from '../game/rules.ts'
import {
  acceptedWordsOf,
  currentWord,
  Run,
  startRun,
  submitWord,
} from '../game/run.ts'

// MODEL

export const Game = defineTaggedUnion({
  Loading: {},
  Failed: { reason: Schema.String },
  Ready: { puzzle: Puzzle, run: Run, draft: Schema.String },
})

export type Game = typeof Game.Type

export const Model = Schema.Struct({ today: IsoDate, game: Game })

export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  SucceededFetchPuzzle: { puzzle: Puzzle },
  FailedFetchPuzzle: { reason: Schema.String },
  UpdatedDraft: { value: Schema.String },
  ClickedTile: { index: Schema.Int },
  SubmittedDraft: {},
})

export type Message = typeof Message.Type

// FLAGS

export const Flags = Schema.Struct({ today: IsoDate })

export type Flags = typeof Flags.Type

export const flags = Effect.map(
  Effect.clockWith(clock => clock.currentTimeMillis),
  now => ({
    today: utcDateOf(now),
  }),
)

// COMMAND

export const FetchPuzzle = Command.define('FetchPuzzle', {
  args: { date: IsoDate },
  messages: [Message.SucceededFetchPuzzle, Message.FailedFetchPuzzle],
  execute: ({ date }) =>
    Effect.tryPromise(() =>
      fetch(`/api/puzzle/${date}`).then(response => response.json()),
    ).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Puzzle)),
      Effect.map(puzzle => Message.SucceededFetchPuzzle({ puzzle })),
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedFetchPuzzle({
            reason: 'Could not load today’s puzzle.',
          }),
        ),
      ),
    ),
})

// INIT

export const init: Runtime.ApplicationInit<
  Model,
  Message,
  Flags
> = startFlags => ({
  model: { today: startFlags.today, game: Game.Loading() },
  commands: [FetchPuzzle({ date: startFlags.today })],
})

// UPDATE

const withReady = (
  model: Model,
  transform: (ready: Extract<Game, { readonly _tag: 'Ready' }>) => Game,
): Model =>
  modifyFields(model, {
    game: game =>
      Game.match(game, {
        Loading: () => game,
        Failed: () => game,
        Ready: ready => transform(ready),
      }),
  })

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    SucceededFetchPuzzle: ({ puzzle }) => ({
      model: modifyFields(model, {
        game: () => Game.Ready({ puzzle, run: startRun(puzzle), draft: '' }),
      }),
    }),
    FailedFetchPuzzle: ({ reason }) => ({
      model: modifyFields(model, { game: () => Game.Failed({ reason }) }),
    }),
    UpdatedDraft: ({ value }) => ({
      model: withReady(model, ready =>
        Game.Ready({ ...ready, draft: normalizeWord(value) }),
      ),
    }),
    ClickedTile: ({ index }) => ({
      model: withReady(model, ready => {
        const word = currentWord(ready.run)
        const letter = word[index] ?? ''
        const isUsed = usedPositions(word, ready.draft)[index] ?? false

        return isUsed
          ? ready
          : Game.Ready({ ...ready, draft: ready.draft + letter })
      }),
    }),
    SubmittedDraft: () => ({
      model: withReady(model, ready => {
        const submitted = submitWord(
          ready.run,
          ready.puzzle,
          acceptedWordsOf(ready.puzzle),
          ready.draft,
        )

        return MoveVerdict.match(submitted.verdict, {
          Empty: () => ready,
          UsesMissingLetters: () => ready,
          TooShort: () => ready,
          NotShorter: () => ready,
          NotAWord: () => ready,
          Valid: () => Game.Ready({ ...ready, run: submitted.run, draft: '' }),
        })
      }),
    }),
  })

// VIEW

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'yeet it',
  body: h.main(
    [h.Class('app')],
    [
      h.h1([h.Class('brand')], ['yeet it']),
      Game.match(model.game, {
        Loading: () => h.p([], ['Loading today’s puzzle…']),
        Failed: ({ reason }) => h.p([h.Role('alert')], [reason]),
        Ready: ({ run, draft }) => {
          const word = currentWord(run)
          const used = usedPositions(word, draft)

          return h.section(
            [],
            [
              h.p([], [`Words made: ${run.chain.length} / 6`]),
              h.div(
                [h.Class('rack')],
                word
                  .split('')
                  .map((letter, index) =>
                    h.button(
                      [
                        h.Type('button'),
                        h.Class(used[index] === true ? 'tile used' : 'tile'),
                        h.OnClick(Message.ClickedTile({ index })),
                      ],
                      [letter],
                    ),
                  ),
              ),
              h.form(
                [h.OnSubmit(Message.SubmittedDraft())],
                [
                  h.input([
                    h.AriaLabel('Your next word'),
                    h.Value(draft),
                    h.OnInput(value => Message.UpdatedDraft({ value })),
                  ]),
                  h.button([h.Type('submit')], ['Yeet']),
                ],
              ),
              h.ol(
                [],
                run.chain.map(step =>
                  h.li([], [`${step.word} − ${step.removed.join(' ')}`]),
                ),
              ),
            ],
          )
        },
      }),
    ],
  ),
})
