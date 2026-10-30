import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { IsoDate } from '../game/day.ts'
import { Puzzle } from '../game/puzzle.ts'

export const Message = defineMessageUnion({
  SucceededFetchPuzzle: { puzzle: Puzzle },
  FailedFetchPuzzle: { reason: Schema.String },
  ClickedRetry: {},
  UpdatedDraft: { value: Schema.String },
  ClickedTile: { index: Schema.Int },
  ClickedBackspace: {},
  ClickedClear: {},
  ClickedShuffle: {},
  CompletedShuffleRack: { rack: Schema.String },
  SubmittedDraft: {},
  ClickedFinish: {},
  ClickedCancelFinish: {},
  ClickedConfirmFinish: {},
  ClickedCopy: {},
  CompletedCopyResult: { copied: Schema.Boolean },
  CompletedSelectShareText: {},
  SucceededSaveProgress: {},
  FailedSaveProgress: {},
  ReachedNewDay: { date: IsoDate },
  ClickedPlayToday: {},
})

export type Message = typeof Message.Type
