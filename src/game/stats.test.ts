import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { ballrooms } from './fixtures.ts'
import { finishRun, startRun } from './run.ts'
import { emptyStats, recordFinish, streakOn } from './stats.ts'

const finishedOn = (date: string) => finishRun({ ...startRun(ballrooms), date })

describe('stats', () => {
  test('extends a streak on consecutive UTC days', () => {
    const stats = [
      finishedOn('2026-11-01'),
      finishedOn('2026-11-02'),
      finishedOn('2026-11-03'),
    ].reduce(recordFinish, emptyStats)

    expect(stats.currentStreak).toBe(3)
    expect(stats.bestStreak).toBe(3)
    expect(stats.played).toBe(3)
    expect(stats.lastFinished).toStrictEqual(Option.some('2026-11-03'))
  })

  test('restarts after a missed day but keeps the best streak', () => {
    const stats = [
      finishedOn('2026-11-01'),
      finishedOn('2026-11-02'),
      finishedOn('2026-11-04'),
    ].reduce(recordFinish, emptyStats)

    expect(stats.currentStreak).toBe(1)
    expect(stats.bestStreak).toBe(2)
  })

  test('counts a day once', () => {
    const once = recordFinish(emptyStats, finishedOn('2026-11-01'))

    expect(recordFinish(once, finishedOn('2026-11-01'))).toBe(once)
  })

  test('shows a lapsed streak as zero', () => {
    const stats = recordFinish(emptyStats, finishedOn('2026-11-01'))

    expect(streakOn(stats, '2026-11-02')).toBe(1)
    expect(streakOn(stats, '2026-11-03')).toBe(0)
  })
})
