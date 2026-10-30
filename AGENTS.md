# yeet it

Read `docs/BUILD.md` before implementing. The user has approved the requirements in that document.

- Application and generator: TypeScript with Effect v4. Deployment: Cloudflare Workers through Alchemy 2. Evaluate and use Foldkit, measuring the first production slice before expanding it.
- Keep gameplay local and immediate after the daily puzzle loads. Keep the delivered assets small and measure the actual compressed production bundle.
- Preserve the tested mechanics and descending green/black emoji share grid.
- No manual daily puzzle selection or approval. Validate the puzzle pool with the solver and familiarity data, then automatically publish a buffered, immutable daily schedule.
- The existing `prototype/` is a reference experiment, not the production architecture.
- Prefer current official documentation and installed source over remembered Effect v3 or Alchemy v1 examples. Pin compatible versions.
- Test meaningful game rules, daily persistence, scheduling, and generator invariants. Run typechecking, tests, production build, and bundle measurement.
- Never commit credentials or deployment state. Preserve third-party data licences and attribution. Ask for secrets through T3's private secret flow when needed; never ask the user to paste them in chat.
- This task explicitly delegates implementation to Claude Opus 5.5 with high effort. A delegated child should do the work itself without spawning additional agents.

## Lint, format, and commits

- Lint with Oxlint using Dillon Mulroy's vendored anti-slop rules (`tools/oxlint/anti-slop/`, provenance in its `UPSTREAM.md`). Every generic rule and the optional Effect rule group are enabled at `error`. Keep `oxlint` and `@oxlint/plugins` pinned to the same exact version.
- Format with Oxfmt. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and `pnpm puzzles:verify` must pass locally and in CI.
- Fix findings in owned code (application, generator, tests, configuration). Do not disable rules globally or exclude owned code to get green checks. Ignores are limited to the vendored rule source, agent tooling directories, generated/vendored data, build output, and the frozen `prototype/` reference.
- Commit and push coherent milestones to `origin/main` as work progresses.
- Do not filter offensive words from the dictionary, start words, or routes. Familiarity is decided by frequency thresholds only.
