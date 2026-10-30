import { Array, Equivalence } from 'effect'

import { spellableWords } from '../game/subwords.ts'
import {
  evaluateCandidate,
  isFamiliar,
  type Candidate,
  type Lexicon,
  meetsPolicy,
  startCandidates,
} from './pool.ts'
import {
  difficultyOf,
  entryFor,
  type Entry,
  GENERATOR_VERSION,
  type Problem,
  type Schedule,
  type SchedulePolicy,
  structuralProblems,
  type Versions,
} from './schedule.ts'

/** Every multiset representative that satisfies the familiarity and opening policy. */
export const eligiblePool = (
  lexicon: Lexicon,
  policy: SchedulePolicy,
): ReadonlyArray<Candidate> =>
  startCandidates(lexicon, policy.familiarity).flatMap(start => {
    const candidate = evaluateCandidate(lexicon, policy.familiarity, start)

    return meetsPolicy(policy.familiarity, candidate.metrics) ? [candidate] : []
  })

const entryProblems = (
  lexicon: Lexicon,
  policy: SchedulePolicy,
  versions: Versions,
  entry: Entry,
): ReadonlyArray<Problem> => {
  const membership = [entry.start, ...entry.route].flatMap(word =>
    lexicon.accepted.has(word)
      ? []
      : [`${entry.date}: ${word} is not in the accepted dictionary`],
  )

  const isCurrentGeneration =
    entry.generator === GENERATOR_VERSION &&
    entry.dictionary === versions.dictionary &&
    entry.frequency === versions.frequency

  if (!isCurrentGeneration) {
    return membership
  }

  const candidate = evaluateCandidate(lexicon, policy.familiarity, entry.start)

  const expected = entryFor(
    entry.date,
    candidate,
    difficultyOf(policy, candidate.metrics),
    versions,
  )

  const unfamiliar = entry.route.flatMap(word =>
    isFamiliar(lexicon, policy.familiarity, word)
      ? []
      : [
          `${entry.date}: route word ${word} is below the familiarity threshold`,
        ],
  )

  return [
    ...membership,
    ...unfamiliar,
    ...(meetsPolicy(policy.familiarity, candidate.metrics)
      ? []
      : [`${entry.date}: ${entry.start} no longer meets the puzzle policy`]),
    ...(JSON.stringify(expected) === JSON.stringify(entry)
      ? []
      : [
          `${entry.date}: ${entry.start} does not match a fresh solver evaluation`,
        ]),
  ]
}

/** Full verification: structure plus a fresh solver/dictionary check of every entry. */
export const verifySchedule = (
  lexicon: Lexicon,
  policy: SchedulePolicy,
  versions: Versions,
  schedule: Schedule,
): ReadonlyArray<Problem> => [
  ...structuralProblems(policy, schedule),
  ...schedule.entries.flatMap(entry =>
    entryProblems(lexicon, policy, versions, entry),
  ),
]

/** The words the Worker will publish for an entry; must equal the generator's view of the puzzle. */
export const publishedWords = (
  dictionary: ReadonlyArray<string>,
  entry: Entry,
): ReadonlyArray<string> => spellableWords(entry.start, dictionary)

export const payloadProblems = (
  lexicon: Lexicon,
  policy: SchedulePolicy,
  dictionary: ReadonlyArray<string>,
  entries: ReadonlyArray<Entry>,
): ReadonlyArray<Problem> =>
  entries.flatMap(entry => {
    const words = publishedWords(dictionary, entry)

    const candidate = evaluateCandidate(
      lexicon,
      policy.familiarity,
      entry.start,
    )

    const missingRoute = entry.route.filter(word => !words.includes(word))

    return [
      ...(Array.makeEquivalence(Equivalence.strictEqual<string>())(
        words,
        candidate.words,
      )
        ? []
        : [
            `${entry.date}: published words differ from the generator's subword list`,
          ]),
      ...Array.map(
        missingRoute,
        word =>
          `${entry.date}: route word ${word} missing from the published words`,
      ),
    ]
  })
