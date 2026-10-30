import { Option, Schema } from 'effect'

import { addDays, IsoDate } from './day.ts'
import { MAXIMUM_SCORE } from './rules.ts'
import { type Run, score } from './run.ts'

/** Device-only history. A day counts once its run is finished. */
export const Stats = Schema.Struct({
  played: Schema.Int,
  perfect: Schema.Int,
  currentStreak: Schema.Int,
  bestStreak: Schema.Int,
  lastFinished: Schema.Option(IsoDate),
})

export type Stats = typeof Stats.Type

export const emptyStats: Stats = {
  played: 0,
  perfect: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastFinished: Option.none(),
}

/** Record a finished run. Recording the same day twice changes nothing. */
export const recordFinish = (stats: Stats, run: Run): Stats => {
  if (Option.contains(stats.lastFinished, run.date)) {
    return stats
  }

  const continues = Option.contains(stats.lastFinished, addDays(run.date, -1))
  const currentStreak = continues ? stats.currentStreak + 1 : 1

  return {
    played: stats.played + 1,
    perfect: stats.perfect + (score(run) === MAXIMUM_SCORE ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    lastFinished: Option.some(run.date),
  }
}

/** The streak as of `today`: it survives until a whole UTC day passes without a finished run. */
export const streakOn = (stats: Stats, today: IsoDate): number =>
  Option.contains(stats.lastFinished, today) ||
  Option.contains(stats.lastFinished, addDays(today, -1))
    ? stats.currentStreak
    : 0
