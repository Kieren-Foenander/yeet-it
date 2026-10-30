# yeet it — agreed implementation brief

## Outcome and scope

Build and deploy the complete first version of the daily mobile word game `yeet it`. The user played `prototype/yeet-prototype.html` in chat, enjoyed it, and approved the mechanics. This is an implementation task, not another design brainstorm. Keep the prototype as a reference and build a maintainable production application.

Public repository: https://github.com/Kieren-Foenander/yeet-it . Device-only progress and streaks, one shared daily puzzle resetting at midnight UTC, no accounts or leaderboard in v1. Include instructions and the copied shrinking-grid result.

## Required stack and verified compatibility

- TypeScript and Effect v4. Use Effect for schemas, IO, typed failures, browser commands, generation, and application services. Keep deterministic game rules and solver algorithms simple and pure.
- Foldkit frontend. Its Model/Message/update/Command architecture suits this game. Start with a playable vertical slice and measure the production bundle before building out the rest.
- Cloudflare Workers hosting, deployed using Alchemy 2. Do not substitute Pages or deploy through an unrelated framework.
- Research on 2026-10-30 found `effect@4.1.0`, `foldkit@0.170.0` (Effect peer dependency `~4.1.0`), and `alchemy@2.0.0-beta.84` (Effect peer dependency `^4.0.5`). Recheck compatibility and pin a working set. Alchemy 2 is beta; do not copy Alchemy 1 snippets.
- Alchemy provides `Cloudflare.Website.Foldkit` in `@alchemy.run/cloudflare`, supports Vite-built static assets and a custom Worker entry for API routes. See https://alchemy.run/cloudflare/frontend/foldkit/ and its official linked examples. The source configuration is authoritative if documentation differs.
- Other references: https://foldkit.dev/core/architecture , https://effect.website/docs/v4/getting-started , https://developers.cloudflare.com/workers/static-assets/ .

## First milestone: real production slice

Load a puzzle, type or tap letters, submit a valid smaller word, permanently remove unused letters, and render the new state. Build in production mode, ensure development tooling is excluded, and measure actual gzip JS + CSS delivery. Starting target: under 100 KB compressed initial JS + CSS (puzzle data measured separately). This is a target to verify, not a promised measurement. Optimize actual imports/builds as needed. Do not claim success without measurements, and do not silently drop Foldkit, Effect, or Alchemy if a compatibility or size problem appears. Report an irreconcilable problem concretely.

## Game rules

1. Everyone gets the same familiar nine-letter starting word for a given UTC date.
2. Form a new valid word using a subset of the current word's letters, rearranging freely. Respect duplicate letter counts.
3. Each submitted word must remove at least one letter, and must be at least three letters long.
4. On valid submission, all unused letters are permanently removed. One new word earns one point. The starting word does not score.
5. Multiple letters may be removed in one move; skipping a length sacrifices a potential point. Same-length anagrams cannot score.
6. The daily puzzles must support a full route through 8, 7, 6, 5, 4, 3 letters using familiar words: max score is always 6/6.
7. Invalid words and unfinished drafts cost nothing. Committed moves cannot be undone. No timer or speed tiebreaker.
8. End at three letters, when there are no valid shorter accepted words left, or when the player chooses to finish.
9. Persist the daily committed run, completion, and streaks on the device; survive reloads. Use validated/versioned storage and handle unavailable/corrupt storage without breaking play. Daily rollover must not apply a previous day's letters to a new puzzle.
10. Production has one daily attempt per browser; reset and puzzle selection in the reference prototype are practice conveniences, not the daily game rules.

## Sharing

There are always six rows, representing lengths 8 down to 3. A row has one emoji square per letter at that length. A green row means the player made a word of that length; a black row means that length was missed. Include the game name, stable puzzle/day number, and words made out of six. Never reveal the words or deleted letters in the shared text. Include the deployed URL once known.

Example shape (first row is eight squares):

```text
yeet it #001
🟩🟩🟩🟩🟩🟩🟩🟩
⬛️⬛️⬛️⬛️⬛️⬛️⬛️
🟩🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
🟩🟩🟩🟩
🟩🟩🟩
5/6 words
```

Use clipboard with an accessible manual-copy fallback. Revealing one solution after completion is useful and present in the prototype.

## Dictionary and familiarity

- User explicitly accepted ENABLE as the source of truth for valid words: https://github.com/dolph/dictionary/blob/master/enable1.txt . Fetch/vendor a fixed, documented snapshot with appropriate provenance/notices; do not fetch a third-party dictionary API during gameplay.
- Source list is approximately 105,145 entries of 3–9 letters, 257 KiB gzipped in the measured snapshot. Browser should load only the current puzzle's possible words, not the whole source list.
- Include accepted ordinary plurals and verb forms from the list; retain regional variants present in the chosen source. Exclude punctuation/spaces, abbreviations/proper names as far as reliable source metadata permits; do not claim perfect classification from capitalization alone in a lowercased list.
- Do not require every accepted word to be familiar. Use a narrower, frequency-scored subset for starting words and at least one full-score route, while allowing the broad accepted dictionary in play.
- Candidate frequency source: https://github.com/rspeer/wordfreq . It provides Zipf frequency estimates from multiple text sources, with data through roughly 2021. It is suitable for established vocabulary, not an absolute guarantee of human familiarity. Preserve its Apache code licence and CC BY-SA data attribution/conditions if using/exporting its frequency data. A one-time data export using Python tooling is acceptable if useful, but the application and puzzle-generation pipeline should be TypeScript/Effect and should not require Python in the Worker.
- Choose and document actual familiarity and puzzle-quality thresholds after measuring the candidate pool. Do not claim an unmeasured number of suitable puzzles. Avoid manual word selection or hand-authored starting-word schedules.

## Fully autonomous puzzle supply

Build a reproducible generator that:

- Enumerates eligible familiar nine-letter words from the chosen ENABLE snapshot.
- Computes all legal subset/anagram transitions and proves a full-score familiar route exists.
- Measures approachable first moves and the fraction retaining a full-score familiar route, so selections avoid pathological openings and can have controlled difficulty.
- Deduplicates identical nine-letter multisets and recent starting words.
- Produces a stable, immutable date-to-puzzle schedule, records dictionary/generator versions, and preserves already published assignments across rebuilds.
- Generates a substantial buffer ahead of time and automatically replenishes it through CI/scheduled automation. Gameplay must not rely on a midnight generation job. Validate the buffer and fail loudly rather than silently publishing unverified puzzles.
- Publishes only the small current-day payload to the browser path. Prefer a simple static-asset/Worker architecture; add storage only where actually needed. Keep future puzzle artifacts out of the initial client bundle.

## Delivery and performance

Mobile-first, fast, accessible, clean typography with system fonts, lightweight CSS interactions, native keyboard and tappable letter tiles. Drafting and reordering are reversible before submission. Obvious remaining letters, discarded-letter preview, committed chain, score, rules, saved state, and result sharing.

Serve cacheable HTML/CSS/JS through Workers Static Assets. Local gameplay after loading: no per-guess network request, no AI judge. Scope v1 to daily play, progress/streaks, instructions, sharing, and generation. Keep dependency and visual overhead low. Separate deployment dependencies from browser entrypoints, measure bundles, and use cache-safe versioned puzzle data.

## Verification and deployment

Test duplicate letters, permanent deletions, same-length rejection, skipped-length scores/share rows, three-letter finish, true dead ends, dictionary membership, save/restore, daily rollover, and the generator's familiar six-step route invariant. Verify accessible mobile interactions and clipboard fallback where feasible. Run typecheck, meaningful tests, production build, and compressed bundle measurement.

Set up automated CI and Alchemy deployment. Use existing authenticated Cloudflare credentials if available; never print or commit credentials. If a secret is missing, report the exact blocker to the parent so it can request the credential using T3's private secret tool. Continue all independent implementation and validation work while deployment credentials are pending. Use the available workers.dev hostname initially; custom domain is optional later. Do not use Wrangler as a deployment substitute for Alchemy.

User has authorized creating the public repo, committing/pushing this new application's implementation, setting up the deployment, and publishing the first version. There is no existing branch/PR workflow; direct commits to main are reasonable for initial setup. If you create/push a PR, link it immediately with T3's `link_pull_request`; never watch PRs as a delegated child.

Implement as one Opus 5.5 high-effort delegate. Do the work yourself without spawning more agents. Report what works, all validation and bundle measurements, the candidate-pool results, public repo/deployed URLs, and any concrete unresolved issue. Do not call deployment complete without actually checking the deployed application.
