import { Array, Order, pipe, String } from 'effect'

export const ALPHABET_SIZE = 26

const CODE_A = 65

export type LetterCounts = ReadonlyArray<number>

export const normalizeWord = (raw: string): string =>
  pipe(raw, String.toUpperCase, String.replaceAll(/[^A-Z]/g, ''))

export const isLetters = (raw: string): boolean => /^[A-Z]+$/.test(raw)

export const letterIndex = (letter: string): number =>
  letter.charCodeAt(0) - CODE_A

export const letterCounts = (word: string): LetterCounts =>
  Array.reduce(
    word.split(''),
    Array.makeBy(ALPHABET_SIZE, () => 0),
    (counts, letter) => {
      counts[letterIndex(letter)] = (counts[letterIndex(letter)] ?? 0) + 1

      return counts
    },
  )

export const countsFitWithin = (
  part: LetterCounts,
  whole: LetterCounts,
): boolean => part.every((count, index) => count <= (whole[index] ?? 0))

export const fitsWithin = (part: string, whole: string): boolean =>
  countsFitWithin(letterCounts(part), letterCounts(whole))

export const multisetKey = (word: string): string =>
  pipe(word.split(''), Array.sort(Order.String), Array.join(''))

/** Letters of `whole` left over after spelling `part`, in `whole`'s order. */
export const leftoverLetters = (
  whole: string,
  part: string,
): ReadonlyArray<string> =>
  Array.reduce(
    whole.split(''),
    { budget: [...letterCounts(part)], leftover: Array.empty<string>() },
    (state, letter) => {
      const remaining = state.budget[letterIndex(letter)] ?? 0

      if (remaining > 0) {
        state.budget[letterIndex(letter)] = remaining - 1
      } else {
        state.leftover.push(letter)
      }

      return state
    },
  ).leftover

/** For each letter of `whole`, whether spelling `draft` consumes it. Earlier duplicates are used first. */
export const usedPositions = (
  whole: string,
  draft: string,
): ReadonlyArray<boolean> =>
  Array.reduce(
    whole.split(''),
    { budget: [...letterCounts(draft)], used: Array.empty<boolean>() },
    (state, letter) => {
      const remaining = state.budget[letterIndex(letter)] ?? 0

      state.used.push(remaining > 0)

      if (remaining > 0) {
        state.budget[letterIndex(letter)] = remaining - 1
      }

      return state
    },
  ).used
