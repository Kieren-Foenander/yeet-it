import { createHash } from 'node:crypto'

import { Data, Effect, String } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import { ENABLE_SHA256, parseEnable } from './dictionary.ts'
import type { FrequencyTable } from './pool.ts'

export { DICTIONARY_VERSION, ENABLE_SHA256, parseEnable } from './dictionary.ts'

export const ENABLE_PATH = 'data/enable/enable1.txt'

export const FREQUENCY_PATH = 'data/wordfreq/enable-zipf-en.tsv'

export const FREQUENCY_VERSION = 'wordfreq-3.1.1-large-en'

export class SourceIntegrityError extends Data.TaggedError(
  'SourceIntegrityError',
)<{ readonly path: string; readonly detail: string }> {}

export const sha256 = (contents: string): string =>
  createHash('sha256').update(contents).digest('hex')

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
