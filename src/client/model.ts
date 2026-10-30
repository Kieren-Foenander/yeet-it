import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { IsoDate } from '../game/day.ts'
import { Puzzle } from '../game/puzzle.ts'
import { MoveVerdict } from '../game/rules.ts'
import { Run } from '../game/run.ts'
import { Stats } from '../game/stats.ts'
import { StorageStatus } from './storage.ts'

export const Feedback = defineTaggedUnion({
  Idle: {},
  Banked: { word: Schema.String, removed: Schema.Array(Schema.String) },
  Rejected: { verdict: MoveVerdict },
})

export type Feedback = typeof Feedback.Type

export const CopyState = Schema.Literals(['Idle', 'Copied', 'Manual'])

export type CopyState = typeof CopyState.Type

export const FinishPrompt = Schema.Literals(['Idle', 'Confirming'])

export type FinishPrompt = typeof FinishPrompt.Type

export const Play = Schema.Struct({
  puzzle: Puzzle,
  run: Run,
  draft: Schema.String,
  /** The current word's letters in display order; shuffling only reorders them. */
  rack: Schema.String,
  feedback: Feedback,
  finishPrompt: FinishPrompt,
  copy: CopyState,
})

export type Play = typeof Play.Type

export const Game = defineTaggedUnion({
  Loading: { saved: Schema.Option(Run) },
  Failed: { reason: Schema.String },
  Ready: { play: Play },
})

export type Game = typeof Game.Type

export const Model = Schema.Struct({
  today: IsoDate,
  origin: Schema.String,
  storage: StorageStatus,
  stats: Stats,
  game: Game,
  /** Set when midnight UTC passes during an unfinished run. */
  nextDay: Schema.Option(IsoDate),
})

export type Model = typeof Model.Type

export const Flags = Schema.Struct({
  today: IsoDate,
  origin: Schema.String,
  storage: StorageStatus,
  stats: Stats,
  run: Schema.Option(Run),
})

export type Flags = typeof Flags.Type
