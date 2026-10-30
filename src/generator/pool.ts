import { Array, Match, Option, Order, pipe } from 'effect'

import { ALPHABET_SIZE, letterIndex, multisetKey } from '../game/letters.ts'
import { MINIMUM_LENGTH, START_LENGTH } from '../game/rules.ts'

/** Zipf frequency × 100 (wordfreq). Missing words have frequency 0. */
export type FrequencyTable = ReadonlyMap<string, number>

export type FamiliarityPolicy = Readonly<{
  /** Minimum Zipf × 100 for a nine-letter starting word. */
  startMinimum: number
  /**
   * Minimum Zipf × 100 for a word to count as familiar, by length (3–8).
   * Short strings collect frequency from abbreviations and names, so they need more evidence.
   */
  routeMinimumByLength: Readonly<Record<RouteLength, number>>
  /** Minimum familiar eight-letter first moves. */
  minimumFamiliarFirstMoves: number
  /** Minimum share (0–1) of familiar first moves that still allow 6/6 with familiar words. */
  minimumFirstMoveRetention: number
}>

export type RouteLength = 3 | 4 | 5 | 6 | 7 | 8

export const routeMinimumFor = (
  policy: FamiliarityPolicy,
  length: number,
): number =>
  Match.value(length).pipe(
    Match.when(3, () => policy.routeMinimumByLength[3]),
    Match.when(4, () => policy.routeMinimumByLength[4]),
    Match.when(5, () => policy.routeMinimumByLength[5]),
    Match.when(6, () => policy.routeMinimumByLength[6]),
    Match.when(7, () => policy.routeMinimumByLength[7]),
    Match.when(8, () => policy.routeMinimumByLength[8]),
    Match.orElse(() => Number.POSITIVE_INFINITY),
  )

export const isFamiliar = (
  lexicon: Lexicon,
  policy: FamiliarityPolicy,
  word: string,
): boolean => frequencyOf(lexicon, word) >= routeMinimumFor(policy, word.length)

type IndexedWord = Readonly<{
  word: string
  counts: Uint8Array
  mask: number
}>

export type Lexicon = Readonly<{
  accepted: ReadonlySet<string>
  byLength: ReadonlyArray<ReadonlyArray<IndexedWord>>
  frequency: FrequencyTable
}>

export type CandidateMetrics = Readonly<{
  word: string
  startFrequency: number
  acceptedWords: number
  familiarWords: number
  acceptedFirstMoves: number
  familiarFirstMoves: number
  winningFirstMoves: number
  firstMoveRetention: number
  fullRoutes: number
}>

export type Candidate = Readonly<{
  metrics: CandidateMetrics
  /** Most familiar full-score route, eight letters down to three. */
  route: ReadonlyArray<string>
  /** All accepted words of three to eight letters spellable from the start word. */
  words: ReadonlyArray<string>
}>

const indexWord = (word: string): IndexedWord => {
  const counts = new Uint8Array(ALPHABET_SIZE)

  const mask = word.split('').reduce((bits, letter) => {
    const index = letterIndex(letter)

    counts[index] = (counts[index] ?? 0) + 1

    return bits | (1 << index)
  }, 0)

  return { word, counts, mask }
}

const fits = (part: IndexedWord, whole: IndexedWord): boolean =>
  (part.mask & ~whole.mask) === 0 &&
  part.counts.every((count, index) => count <= (whole.counts[index] ?? 0))

export const frequencyOf = (lexicon: Lexicon, word: string): number =>
  lexicon.frequency.get(word) ?? 0

export const lexiconOf = (
  words: ReadonlyArray<string>,
  frequency: FrequencyTable,
): Lexicon => {
  const accepted = new Set(words)

  const byLength = Array.makeBy(START_LENGTH + 1, length =>
    words.flatMap(word => (word.length === length ? [indexWord(word)] : [])),
  )

  return { accepted, byLength, frequency }
}

/** Accepted words of three to eight letters contained in `start`, longest first then alphabetical. */
export const subwordsOf = (
  lexicon: Lexicon,
  start: string,
): ReadonlyArray<IndexedWord> => {
  const whole = indexWord(start)

  return Array.makeBy(
    START_LENGTH - MINIMUM_LENGTH,
    offset => START_LENGTH - 1 - offset,
  ).flatMap(length =>
    (lexicon.byLength[length] ?? []).flatMap(candidate =>
      fits(candidate, whole) ? [candidate] : [],
    ),
  )
}

type RouteSearch = Readonly<{
  completes: (word: IndexedWord) => boolean
  routeCount: (word: IndexedWord) => number
  bestRoute: (word: IndexedWord) => ReadonlyArray<string>
}>

/** Full-score search restricted to `familiar`: every step removes exactly one letter. */
const makeRouteSearch = (
  lexicon: Lexicon,
  familiar: ReadonlyArray<IndexedWord>,
): RouteSearch => {
  const familiarByLength = Array.makeBy(START_LENGTH + 1, length =>
    familiar.filter(word => word.word.length === length),
  )

  const children = (word: IndexedWord): ReadonlyArray<IndexedWord> =>
    (familiarByLength[word.word.length - 1] ?? []).filter(child =>
      fits(child, word),
    )

  const counts = new Map<string, number>()

  const routeCount = (word: IndexedWord): number => {
    if (word.word.length === MINIMUM_LENGTH) {
      return 1
    }

    const key = multisetKey(word.word)
    const known = counts.get(key)

    if (known !== undefined) {
      return known
    }

    const total = children(word).reduce(
      (sum, child) => sum + routeCount(child),
      0,
    )

    counts.set(key, total)

    return total
  }

  const completes = (word: IndexedWord): boolean => routeCount(word) > 0

  const byFamiliarity = Order.mapInput(
    Order.Number,
    (word: IndexedWord) => -frequencyOf(lexicon, word.word),
  )

  const bestRoute = (word: IndexedWord): ReadonlyArray<string> => {
    if (word.word.length === MINIMUM_LENGTH) {
      return []
    }

    return pipe(
      children(word),
      Array.filter(completes),
      Array.sort(
        Order.combine(
          byFamiliarity,
          Order.mapInput(Order.String, (child: IndexedWord) => child.word),
        ),
      ),
      Array.head,
      Option.match({
        onNone: () => [],
        onSome: next => [next.word, ...bestRoute(next)],
      }),
    )
  }

  return { completes, routeCount, bestRoute }
}

export const evaluateCandidate = (
  lexicon: Lexicon,
  policy: FamiliarityPolicy,
  start: string,
): Candidate => {
  const subwords = subwordsOf(lexicon, start)

  const familiar = subwords.filter(word =>
    isFamiliar(lexicon, policy, word.word),
  )

  const search = makeRouteSearch(lexicon, familiar)
  const startWord = indexWord(start)

  const firstMoves = subwords.filter(
    word => word.word.length === START_LENGTH - 1,
  )

  const familiarFirstMoves = familiar.filter(
    word => word.word.length === START_LENGTH - 1,
  )

  const winningFirstMoves = familiarFirstMoves.filter(search.completes)

  return {
    metrics: {
      word: start,
      startFrequency: frequencyOf(lexicon, start),
      acceptedWords: subwords.length,
      familiarWords: familiar.length,
      acceptedFirstMoves: firstMoves.length,
      familiarFirstMoves: familiarFirstMoves.length,
      winningFirstMoves: winningFirstMoves.length,
      firstMoveRetention:
        familiarFirstMoves.length === 0
          ? 0
          : winningFirstMoves.length / familiarFirstMoves.length,
      fullRoutes: search.routeCount(startWord),
    },
    route: search.bestRoute(startWord),
    words: Array.map(subwords, word => word.word),
  }
}

export const meetsPolicy = (
  policy: FamiliarityPolicy,
  metrics: CandidateMetrics,
): boolean =>
  metrics.startFrequency >= policy.startMinimum &&
  metrics.fullRoutes > 0 &&
  metrics.familiarFirstMoves >= policy.minimumFamiliarFirstMoves &&
  metrics.firstMoveRetention >= policy.minimumFirstMoveRetention

/** One representative per nine-letter multiset: the most familiar spelling, ties alphabetical. */
export const startCandidates = (
  lexicon: Lexicon,
  policy: FamiliarityPolicy,
): ReadonlyArray<string> => {
  const representatives = (lexicon.byLength[START_LENGTH] ?? [])
    .filter(word => frequencyOf(lexicon, word.word) >= policy.startMinimum)
    .reduce((best, word) => {
      const key = multisetKey(word.word)
      const incumbent = best.get(key)

      if (
        incumbent === undefined ||
        frequencyOf(lexicon, word.word) > frequencyOf(lexicon, incumbent)
      ) {
        best.set(key, word.word)
      }

      return best
    }, new Map<string, string>())

  return pipe([...representatives.values()], Array.sort(Order.String))
}
