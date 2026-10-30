"""One-time export of wordfreq Zipf frequencies for the vendored ENABLE snapshot.

Not used at runtime or by the TypeScript generator. Re-run only to refresh
`data/wordfreq/enable-zipf-en.tsv`, then re-run `pnpm puzzles:verify`.

    python3 -m venv /tmp/wfenv
    /tmp/wfenv/bin/pip install wordfreq==3.1.1
    /tmp/wfenv/bin/python -I tools/wordfreq-export/export.py

Output rows: `<word>\t<zipf * 100, rounded>` for every ENABLE word of 3-9
letters with a non-zero English frequency in wordfreq's `large` list.
Words absent from the output have no measurable frequency (Zipf 0).
"""

import pathlib
import sys

import wordfreq

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data" / "enable" / "enable1.txt"
TARGET = ROOT / "data" / "wordfreq" / "enable-zipf-en.tsv"


def main() -> int:
    words = [line.strip() for line in SOURCE.read_text("ascii").splitlines()]
    eligible = [w for w in words if 3 <= len(w) <= 9 and w.isascii() and w.isalpha() and w.islower()]
    rows = []
    for word in eligible:
        zipf = wordfreq.zipf_frequency(word, "en", wordlist="large")
        if zipf > 0:
            rows.append(f"{word}\t{round(zipf * 100)}")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(
        "# wordfreq " + wordfreq.__dict__.get("__version__", "3.1.1")
        + " zipf_frequency(word, 'en', wordlist='large') x 100 for ENABLE words of 3-9 letters.\n"
        + "# Data: CC BY-SA 4.0, Robyn Speer and contributors. See data/wordfreq/NOTICE.md.\n"
        + "\n".join(rows)
        + "\n",
        "ascii",
    )
    print(f"{len(eligible)} eligible words, {len(rows)} with non-zero frequency", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
