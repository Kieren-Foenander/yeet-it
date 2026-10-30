import { createHash } from 'node:crypto'

import { Array, Data, Effect, pipe, String } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import { MINIMUM_LENGTH, START_LENGTH } from '../game/rules.ts'
import type { FrequencyTable } from './pool.ts'

export const ENABLE_PATH = 'data/enable/enable1.txt'

export const FREQUENCY_PATH = 'data/wordfreq/enable-zipf-en.tsv'

/** github.com/dolph/dictionary enable1.txt at commit 694bf9529e986f9175dcbf5fe5875d111941b708. */
export const ENABLE_SHA256 =
  '3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89'

export const DICTIONARY_VERSION = 'enable1@694bf95'

export const FREQUENCY_VERSION = 'wordfreq-3.1.1-large-en'

export class SourceIntegrityError extends Data.TaggedError(
  'SourceIntegrityError',
)<{ readonly path: string; readonly detail: string }> {}

export const sha256 = (contents: string): string =>
  createHash('sha256').update(contents).digest('hex')

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

export const parseFrequencies = (contents: string): FrequencyTable =>
  contents.split(/\r?\n/).reduce((table, line) => {
    const match = /^([a-z]+)\t(\d+)$/.exec(line)

    if (match !== null) {
      table.set(String.toUpperCase(match[1] ?? ''), Number(match[2]))
    }

    return table
  }, new Map<string, number>())

export const loadSources = Effect.gen(function* () {
  const fs = yield* FileSystem
  const enable = yield* fs.readFileString(ENABLE_PATH)

  if (sha256(enable) !== ENABLE_SHA256) {
    return yield* new SourceIntegrityError({
      path: ENABLE_PATH,
      detail: `sha256 ${sha256(enable)} does not match the pinned ${ENABLE_SHA256}`,
    })
  }

  const frequencies = parseFrequencies(yield* fs.readFileString(FREQUENCY_PATH))

  if (frequencies.size < 50_000) {
    return yield* new SourceIntegrityError({
      path: FREQUENCY_PATH,
      detail: `only ${frequencies.size} frequency rows; expected the full export`,
    })
  }

  return { words: parseEnable(enable), frequencies }
})
