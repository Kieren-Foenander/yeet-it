# yeet it

A daily word game: make a shorter word, yeet the unused letters forever, and build
the longest chain you can.

**Play: https://yeet-it.kfoenander98.workers.dev**

Everyone gets the same familiar nine-letter word each UTC day. Rearrange freely,
drop at least one letter every turn, and stop at three letters. Each new word
scores one point, for a maximum of six (8 → 7 → 6 → 5 → 4 → 3). Skipping a length
loses that point, same-length anagrams never score, invalid words cost nothing,
and committed words can't be undone. The copied result shows one row per length,
green for a word made and black for a length missed:

```text
yeet it #001
🟩🟩🟩🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩🟩
⬛️⬛️⬛️⬛️⬛️
🟩🟩🟩🟩
🟩🟩🟩
5/6 words
https://yeet-it.kfoenander98.workers.dev
```

## How it is built

| Part                                   | What                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/game/`                            | Pure rules: letter multisets, move judging, runs, finishes, streaks, share grid, UTC days    |
| `src/client/`                          | Foldkit (Elm-style Model/Message/update/Command) app on Effect 4.1                           |
| `src/worker/`                          | Cloudflare Worker: `GET /api/puzzle/<date>`, everything else from Workers Static Assets      |
| `src/generator/`, `scripts/puzzles.ts` | Effect pipeline that selects, verifies, and schedules puzzles                                |
| `infra/`                               | Alchemy 2 stack (`Cloudflare.Website.Foldkit`) that builds and deploys the Worker and assets |
| `data/`                                | Pinned ENABLE dictionary, wordfreq familiarity export, and the published schedule            |

Gameplay is local once the day's puzzle has loaded: the browser receives the start
word, every accepted shorter word it contains (~1 KB compressed), and one 6/6
route to reveal after finishing. No request is made per guess. Future puzzles stay
on the server; the Worker serves at most one day ahead of UTC to tolerate fast
device clocks.

Progress and streaks live only on the device, in schema-validated, versioned
`localStorage`. A saved run is replayed against the day's puzzle before it is
restored, so a previous day's letters are never applied to a new puzzle; corrupt
or unavailable storage falls back to a fresh start. At midnight UTC the app loads
the new puzzle, or, mid-run, offers it once the player is ready. A streak counts
consecutive UTC days with a finished run.

The deployment toolchain is a separate workspace package because Alchemy
2.0.0-beta.84 runs on effect 4.0.x (it imports `effect/Crypto`, which 4.1 moved)
while Foldkit 0.170 requires effect 4.1.x. `infra/` pins effect 4.0.7; the app pins
4.1.0. Deployment dependencies stay out of the browser bundle.

## Puzzle supply (no manual selection)

`pnpm puzzles:generate` derives everything from the pinned data and `POLICY` in
`src/generator/schedule.ts`:

1. Take every ENABLE nine-letter word, keep one spelling per letter multiset (the
   most frequent), and require Zipf ≥ 2.5 for the start word.
2. A word counts as **familiar** when its wordfreq Zipf frequency reaches a
   length-dependent threshold: 3 letters ≥ 4.0, 4 ≥ 3.5, 5 ≥ 3.25, 6 ≥ 3.0,
   7 ≥ 2.75, 8 ≥ 2.5. Short strings collect frequency from abbreviations and
   names (at a flat 3.0, three-letter "familiar" words included COZ, DUP, GAN,
   HET), so they need more evidence.
3. Enumerate all accepted subwords, then prove with a memoised search that a full
   8 → 3 route exists using familiar words only, removing exactly one letter per
   step. Count the full routes and the familiar eight-letter openings, and how
   many of those openings still allow 6/6.
4. Keep puzzles with at least one familiar opening and ≥ 50 % of familiar
   openings still winnable. Tier difficulty by full familiar routes (easy ≥ 500,
   hard < 60), and schedule by UTC weekday: Mon–Tue easy, Wed–Thu medium, Fri–Sat
   hard, Sun medium, falling back to a neighbouring tier when one runs out.
5. Pick deterministically (FNV-1a of date + word) among candidates whose letters
   were not used in the last 730 days and whose guaranteed opening was not used in
   the last 30. Append entries; never rewrite published ones.

Measured on the pinned data: 24,873 nine-letter ENABLE words → 4,575 distinct
multisets with start Zipf ≥ 2.5 → **791 eligible puzzles** (277 easy, 249 medium,
265 hard). The first 401 days (2026-10-30 → 2027-12-04) are scheduled, leaving
390 unused puzzles. For comparison, a flat Zipf 3.0 threshold with ≥ 2 familiar
openings yields only 180. Frequency is a proxy for familiarity, not proof of it,
and wordfreq's data ends around 2021. Content is not filtered: the ENABLE list
and frequency thresholds decide everything.

`pnpm puzzles:verify` re-runs the solver on every entry, checks dates, numbering,
reuse windows, dictionary membership and familiarity of every route word, that the
Worker's payload matches the generator's word list, that at least 180 days remain
scheduled, and (with `--published <old schedule>`) that no published day changed.

## Automation

- **CI** (`.github/workflows/ci.yml`): Oxfmt check, Oxlint with the vendored
  anti-slop rules, typecheck (app, Worker, infra), Vitest, schedule verification
  against the previous commit's schedule, production build, bundle measurement.
- **Deploy** (`deploy.yml`): after CI succeeds on `main`, `alchemy deploy --stage
  prod`, then checks the live HTML and today's puzzle. Requires the
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets; without
  them it skips with a warning. Alchemy's CI guide grants Workers Scripts Write,
  Account Settings Write, Secrets Store Write (needed by the `Cloudflare.state()`
  store), and Workers Tail Read, plus KV/R2/D1/Queues/Pages that this stack does
  not use.
- **Replenish** (`replenish.yml`): every Monday, extends the schedule to 400 days
  ahead, verifies it against the previous schedule, commits, and deploys. It fails
  loudly instead of publishing unverified puzzles. With a 400-day buffer, no
  midnight job is ever on the critical path.

## Commands

```sh
pnpm install
pnpm dev                 # local Foldkit app and Worker through Alchemy
pnpm test                # rules, generator invariants, Worker, Foldkit story/scene tests
pnpm lint                # Oxlint + anti-slop (generic and Effect rule groups)
pnpm format:check        # Oxfmt
pnpm typecheck
pnpm puzzles:verify      # full schedule verification
pnpm puzzles:generate    # extend the schedule (append-only)
node scripts/puzzles.ts analyze
pnpm build && node scripts/measure-bundle.ts --url https://yeet-it.kfoenander98.workers.dev
pnpm deploy:prod         # alchemy deploy --stage prod (uses your Alchemy profile)
```

## Bundle

See [docs/MEASUREMENTS.md](docs/MEASUREMENTS.md). Current production build:
332.2 KB raw, **107.1 KB gzip** (93.3 KB brotli q11) for the initial JS + CSS;
107.0 KB gzip / 109.0 KB br actually downloaded from Cloudflare. The Foldkit +
Effect floor alone is ~97 KB gzip, so the provisional 100 KB target is missed by
about 7 KB.

## Data and licences

- Dictionary: ENABLE (public domain) from
  [dolph/dictionary](https://github.com/dolph/dictionary) at a pinned commit.
  See [data/enable/NOTICE.md](data/enable/NOTICE.md).
- Familiarity: [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1 by Robyn
  Speer. The exported frequencies are CC BY-SA 4.0 (wordfreq code: Apache 2.0).
  See [data/wordfreq/NOTICE.md](data/wordfreq/NOTICE.md).
- Lint rules: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), MIT,
  vendored in `tools/oxlint/anti-slop/` with its provenance.

The game's own code does not yet declare a licence. The original mechanics
experiment is kept in `prototype/` as a reference.
