# YEET mechanics playtest

Throwaway, self-contained HTML. Open `yeet-prototype.html` directly; no server or build required.

Question: Does committing to progressively smaller anagrams feel strategic and fun?

Rules: rearrange freely; permanently remove at least one letter per submission; one point per new word; three-letter minimum; invalid attempts free. Skipped lengths are black rows in the copied result. Start word does not score. Runs can be reset and four practice puzzles are available. In-memory state only.

Dictionary: ENABLE1, fetched from https://github.com/dolph/dictionary/blob/master/enable1.txt and restricted to possible subsets of the four practice starting words. Some obscure and inflected words count. A memoized solver computes the actual longest chain for each puzzle and reveals one route after finishing.

Playtest verdict: pending user feedback.
