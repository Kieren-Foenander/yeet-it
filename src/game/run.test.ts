import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { ballrooms } from './fixtures.ts'
import { MoveVerdict } from './rules.ts'
import {
  acceptedWordsOf,
  currentWord,
  finishRun,
  restoreRun,
  type Run,
  RunStatus,
  score,
  shareRows,
  shareText,
  startRun,
  submitWord,
} from './run.ts'

const accepted = acceptedWordsOf(ballrooms)

const play = (words: ReadonlyArray<string>): Run =>
  words.reduce(
    (run, word) => submitWord(run, ballrooms, accepted, word).run,
    startRun(ballrooms),
  )

describe('run', () => {
  test('starts unscored on the nine-letter word', () => {
    const run = startRun(ballrooms)

    expect(currentWord(run)).toBe('BALLROOMS')
    expect(score(run)).toBe(0)
  })

  test('removes unused letters permanently', () => {
    const run = play(['BROOMS'])

    expect(currentWord(run)).toBe('BROOMS')
    expect(run.chain[0]?.removed).toStrictEqual(['A', 'L', 'L'])
    expect(submitWord(run, ballrooms, accepted, 'BALL').verdict).toStrictEqual(
      MoveVerdict.UsesMissingLetters(),
    )
  })

  test('leaves the run untouched on an invalid word', () => {
    const run = play(['BROOMS'])
    const attempt = submitWord(run, ballrooms, accepted, 'BROOMS')

    expect(attempt.run).toBe(run)
    expect(attempt.verdict).toStrictEqual(MoveVerdict.NotShorter())
  })

  test('scores one point per word and finishes at three letters', () => {
    const run = play(['BALLROOM', 'BROOM', 'BOOM', 'MOB'])

    expect(score(run)).toBe(4)
    expect(run.status).toStrictEqual(
      RunStatus.Finished({ reason: 'ReachedMinimum' }),
    )
  })

  test('finishes on a true dead end', () => {
    const run = play(['ROLLS'])

    expect(run.status).toStrictEqual(
      RunStatus.Finished({ reason: 'NoShorterWord' }),
    )
  })

  test('lets the player finish early, and finished runs accept nothing', () => {
    const run = finishRun(play(['BROOMS']))

    expect(run.status).toStrictEqual(RunStatus.Finished({ reason: 'Chose' }))
    expect(submitWord(run, ballrooms, accepted, 'BROOM').run).toBe(run)
  })

  test('shares six descending rows: green for made lengths, black for skipped', () => {
    const run = play(['BROOMS', 'BROOM', 'BOOM', 'MOB'])

    expect(shareRows(run)).toStrictEqual([
      '⬛️'.repeat(8),
      '⬛️'.repeat(7),
      '🟩'.repeat(6),
      '🟩'.repeat(5),
      '🟩'.repeat(4),
      '🟩'.repeat(3),
    ])
    expect(shareText(run, 'https://example.test')).toBe(
      [
        'yeet it #007',
        '⬛️⬛️⬛️⬛️⬛️⬛️⬛️⬛️',
        '⬛️⬛️⬛️⬛️⬛️⬛️⬛️',
        '🟩🟩🟩🟩🟩🟩',
        '🟩🟩🟩🟩🟩',
        '🟩🟩🟩🟩',
        '🟩🟩🟩',
        '4/6 words',
        'https://example.test',
      ].join('\n'),
    )
  })

  test('never reveals words or letters in the share text', () => {
    const text = shareText(play(['BROOMS', 'BROOM']), 'https://example.test')

    expect(text).not.toMatch(/BROOMS|BROOM|BALLROOMS/)
  })
})

describe('restoreRun', () => {
  test('replays a saved run for the same puzzle', () => {
    const saved = play(['BROOMS', 'BROOM'])

    expect(restoreRun(saved, ballrooms)).toStrictEqual(Option.some(saved))
  })

  test('restores a run the player chose to finish', () => {
    const saved = finishRun(play(['BROOMS']))

    expect(restoreRun(saved, ballrooms)).toStrictEqual(Option.some(saved))
  })

  test("never applies a previous day's letters to a new puzzle", () => {
    const saved = play(['BROOMS'])
    const tomorrow = { ...ballrooms, date: '2026-11-06', number: 8 }

    expect(restoreRun(saved, tomorrow)).toStrictEqual(Option.none())
  })

  test('discards tampered chains that do not replay', () => {
    const saved = play(['BROOMS'])

    const tampered: Run = {
      ...saved,
      chain: [{ word: 'BALLS', removed: [] }, ...saved.chain],
    }

    expect(restoreRun(tampered, ballrooms)).toStrictEqual(Option.none())
  })
})
