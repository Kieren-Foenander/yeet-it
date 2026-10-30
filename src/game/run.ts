import { Array, Option, pipe, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { formatPuzzleNumber, IsoDate } from './day.ts'
import { type Puzzle, UppercaseWord } from './puzzle.ts'
import {
  hasShorterWord,
  judgeMove,
  MAXIMUM_SCORE,
  MINIMUM_LENGTH,
  MoveVerdict,
  SCORING_LENGTHS,
} from './rules.ts'

export const Step = Schema.Struct({
  word: UppercaseWord,
  removed: Schema.Array(Schema.String),
})

export type Step = typeof Step.Type

export const FinishReason = Schema.Literals([
  'ReachedMinimum',
  'NoShorterWord',
  'Chose',
])

export type FinishReason = typeof FinishReason.Type

export const RunStatus = defineTaggedUnion({
  Playing: {},
  Finished: { reason: FinishReason },
})

export type RunStatus = typeof RunStatus.Type

export const Run = Schema.Struct({
  date: IsoDate,
  number: Schema.Int,
  start: UppercaseWord,
  chain: Schema.Array(Step),
  status: RunStatus,
})

export type Run = typeof Run.Type

export const startRun = (puzzle: Puzzle): Run => ({
  date: puzzle.date,
  number: puzzle.number,
  start: puzzle.start,
  chain: [],
  status: RunStatus.Playing(),
})

export const currentWord = (run: Run): string =>
  Option.match(Array.last(run.chain), {
    onNone: () => run.start,
    onSome: step => step.word,
  })

export const score = (run: Run): number => run.chain.length

export const isFinished = (run: Run): boolean =>
  RunStatus.match(run.status, {
    Playing: () => false,
    Finished: () => true,
  })

export const acceptedWordsOf = (puzzle: Puzzle): ReadonlySet<string> =>
  new Set(puzzle.words)

const settle = (run: Run, words: ReadonlyArray<string>): Run => {
  const word = currentWord(run)

  if (word.length <= MINIMUM_LENGTH) {
    return { ...run, status: RunStatus.Finished({ reason: 'ReachedMinimum' }) }
  }

  if (!hasShorterWord(word, words)) {
    return { ...run, status: RunStatus.Finished({ reason: 'NoShorterWord' }) }
  }

  return run
}

export type Submission = Readonly<{ run: Run; verdict: MoveVerdict }>

/** Commit a draft. Returns the unchanged run alongside the verdict when the move is not allowed. */
export const submitWord = (
  run: Run,
  puzzle: Puzzle,
  accepted: ReadonlySet<string>,
  draft: string,
): Submission => {
  if (isFinished(run)) {
    return { run, verdict: MoveVerdict.Empty() }
  }

  const verdict = judgeMove(currentWord(run), draft, word => accepted.has(word))

  return MoveVerdict.match(verdict, {
    Empty: () => ({ run, verdict }),
    UsesMissingLetters: () => ({ run, verdict }),
    TooShort: () => ({ run, verdict }),
    NotShorter: () => ({ run, verdict }),
    NotAWord: () => ({ run, verdict }),
    Valid: ({ removed }) => ({
      run: settle(
        { ...run, chain: [...run.chain, { word: draft, removed }] },
        puzzle.words,
      ),
      verdict,
    }),
  })
}

export const finishRun = (run: Run): Run =>
  isFinished(run)
    ? run
    : { ...run, status: RunStatus.Finished({ reason: 'Chose' }) }

/**
 * Rebuild a saved run against today's puzzle by replaying every committed word.
 * Anything that does not replay exactly (another day, another start word, a word
 * the puzzle does not accept, tampered letters) is discarded.
 */
export const restoreRun = (saved: Run, puzzle: Puzzle): Option.Option<Run> => {
  if (
    saved.date !== puzzle.date ||
    saved.number !== puzzle.number ||
    saved.start !== puzzle.start
  ) {
    return Option.none()
  }

  const accepted = acceptedWordsOf(puzzle)

  const replayed = Array.reduce(
    saved.chain,
    Option.some(startRun(puzzle)),
    (maybeRun, step) =>
      Option.flatMap(maybeRun, run => {
        const next = submitWord(run, puzzle, accepted, step.word)

        return next.run === run ? Option.none() : Option.some(next.run)
      }),
  )

  return Option.map(replayed, run =>
    RunStatus.match(saved.status, {
      Playing: () => run,
      Finished: () => finishRun(run),
    }),
  )
}

export const madeLengths = (run: Run): ReadonlySet<number> =>
  new Set(Array.map(run.chain, step => step.word.length))

const GREEN = '🟩'

const BLACK = '⬛️'

/** Six rows, 8 squares down to 3: green for a length the player made, black for a missed one. */
export const shareRows = (run: Run): ReadonlyArray<string> => {
  const made = madeLengths(run)

  return Array.map(SCORING_LENGTHS, length =>
    (made.has(length) ? GREEN : BLACK).repeat(length),
  )
}

export const shareText = (run: Run, url: string): string =>
  pipe(
    [
      `yeet it ${formatPuzzleNumber(run.number)}`,
      ...shareRows(run),
      `${score(run)}/${MAXIMUM_SCORE} words`,
      url,
    ],
    Array.join('\n'),
  )
