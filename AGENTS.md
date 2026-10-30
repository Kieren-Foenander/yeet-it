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
