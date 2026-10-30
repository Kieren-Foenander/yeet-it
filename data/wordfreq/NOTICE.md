# wordfreq frequency export

`enable-zipf-en.tsv` contains English Zipf word frequencies from
[wordfreq](https://github.com/rspeer/wordfreq) 3.1.1 by Robyn Speer, computed with
`wordfreq.zipf_frequency(word, "en", wordlist="large")` for every ENABLE word of
3–9 letters and stored as `round(zipf × 100)`. Words with no measurable frequency
are omitted (treated as 0). It was produced once by
`tools/wordfreq-export/export.py`; Python is not needed to build, test, generate
puzzles, or run the game.

The frequencies are used only by the puzzle generator to decide which words count
as familiar for starting words and the guaranteed full-score route. They are not
shipped to browsers.

## Licence and attribution

This file is a derivative of wordfreq's data and is distributed under the
**Creative Commons Attribution-ShareAlike 4.0** licence
(https://creativecommons.org/licenses/by-sa/4.0/). wordfreq's code is licensed
under the Apache License 2.0; see `WORDFREQ-CODE-LICENSE.txt`.

Citation: Robyn Speer. (2022). rspeer/wordfreq: v3.0 (v3.0.2). Zenodo.
https://doi.org/10.5281/zenodo.7199437

wordfreq's data includes, per its README:

- Google Books Ngrams (http://books.google.com/ngrams) and Google Books Syntactic
  Ngrams.
- The Leeds Internet Corpus, University of Leeds Centre for Translation Studies.
- Wikipedia (http://www.wikipedia.org).
- ParaCrawl (https://paracrawl.eu).
- OPUS OpenSubtitles 2018 (http://opus.nlpl.eu/OpenSubtitles.php), originating from
  OpenSubtitles (http://www.opensubtitles.org/).
- SUBTLEX word lists (SUBTLEX-US, SUBTLEX-UK, SUBTLEX-CH, SUBTLEX-DE, SUBTLEX-NL)
  by Marc Brysbaert et al., freely available at
  http://crr.ugent.be/programs-data/subtitle-frequencies.
- Statistics from the streaming Twitter API, in accordance with Twitter's
  Developer Agreement & Policy.

wordfreq's frequencies reflect text through roughly 2021. Frequency is a proxy for
familiarity, not a guarantee of it.
