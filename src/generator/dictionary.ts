import { Array, pipe, String } from 'effect'

import { MINIMUM_LENGTH, START_LENGTH } from '../game/rules.ts'

/** github.com/dolph/dictionary enable1.txt at commit 694bf9529e986f9175dcbf5fe5875d111941b708. */
export const ENABLE_SHA256 =
  '3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89'

export const DICTIONARY_VERSION = 'enable1@694bf95'

/** ENABLE words of 3–9 letters, uppercased. ENABLE is lowercase a–z only: no proper nouns, abbreviations, or punctuation. */
export const parseEnable = (contents: string): ReadonlyArray<string> =>
  pipe(
    contents.split(/\r?\n/),
    Array.flatMap(line => {
      const word = String.trim(line)

      return /^[a-z]+$/.test(word) &&
        word.length >= MINIMUM_LENGTH &&
        word.length <= START_LENGTH
        ? [String.toUpperCase(word)]
        : []
    }),
  )
