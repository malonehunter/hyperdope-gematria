# Changelog

## v2.5 — NetVoid 2026 Manual Review Merge & Calibrated Junk Filter

### Added
- **+13,855 entries from NetVoid's 2026 manual curation pass** — modern political/conspiracy
  phrases, historical event references, pop culture, esoteric concepts, tech/AI. Sourced from
  `CYPHERS_CLEANED_DDB_2026.txt` which she's manually reviewing (A–R complete, S–Z in
  progress). These are her truly-new additions since her 2023 starting db (14,520 total),
  filtered through our calibrated junk rubric.
- **`tools/classify_candidates.py`** — new calibrated junk-rubric tool. Permissive on modern
  proper nouns, brand names, acronyms (NASA/MAGA/COVID/AI/...), historical-event references,
  and event-phrases with digits (`BLM 2020`, `COVID-19 Policy`, `Election Trump 2024`). Drops
  only shared-consensus junk: pure foreign-script, single-letter pairs, keyboard-mash
  patterns, bare spelled-numbers (no `[N]` annotation), repeated-word patterns, pure-date
  constructions with year, long sentences with very low dictionary density. Drop rate on
  NetVoid's 13,861 truly-new additions: 0.04% (6 entries). Reusable — takes any wordlist,
  emits keep/drop decisions to JSONL or a plain keep-list. Designed for ecosystem reciprocity
  so any merge in either direction stays clean.

### Fixed
- **`tools/normalize_caps.py` no longer mangles modern acronyms via dict-fallthrough.** The
  old all-caps-multi-letter rule fell through to Title Case when the lowercase form was in
  `/usr/share/dict/words` (web2 / Webster's 2nd, 1934), but web2 includes obscure
  historical/Latin/scientific terms that overlap with modern acronyms: `maga`, `covid`, `la`,
  `ai`, `id`, `us`, `it`, `ice` were all silently in the dict and being treated as "shouted
  dict words" to title-case. Rule simplified to: all-caps multi-letter token → **always
  preserve**. Trust the input. 462 acronyms preserved correctly in the NetVoid merge. The
  trade-off — genuinely shouted normal words like `A BIG WIN FOR US` stay all-caps instead of
  becoming Title Case — is rare in curated db entries and clearly the lesser evil.

### Changed
- Database: **216,088 → 229,943 entries** (+6.4%). `db.json` ~74.8 MB raw / ~32.0 MB gz.
  `db_lite.json` ~18.4 MB raw / ~7.4 MB gz. Lite paint still ~2s. `databaseVersion` 3 → 4.

## v2.4 — Highlight-Mode Decouple Toggle & Settings Persistence

### Added
- **Highlight-mode toggle (▼)** next to the highlight box, styled like the ⚡ auto-match
  button (dim/lit on/off). Decouples the history-table highlight semantics from the
  Cross/Same query match mode:
  - Dim (default) = "any matches" — light every cell whose value you typed (cross-style)
  - Lit (toggled) = "same column matches only" — light only values that repeat within a
    cipher column (same-cipher-pairing)
  - The Cross/Same checkboxes in the options panel now affect only the query/modal +
    export (as the names suggest); the history-table highlight has its own switch.
- **Settings persistence** for two opt flags that weren't round-tripping through
  `localStorage`:
  - `optHltSameCipher` (the new toggle) — added to `calcOptionsArr`
  - `autoMatchEnabled` (the ⚡ button state) — was the lone outlier among the opt flags;
    every other one persisted but this one re-read the device-aware default each page
    load. Now persists; the device-aware default still applies for *first* visit per
    device, then the user's choice sticks.
- **Cmd+click on macOS** for the "add value to highlight box" power-user gesture. macOS
  hard-routes Ctrl+click to a `contextmenu` event (firing the right-click hideValue
  toggle instead of the Ctrl+click branch), so the existing gesture was unreachable for
  Mac users. The click handler now accepts `e.metaKey` alongside `ctrlIsPressed`.

### Notes
- Plain left-click on a history value still triggers the cross-table blink sweep
  regardless of the new toggle — that's the quick "where else does this number appear?"
  gesture and predates the match-mode flags. The new toggle governs persistent highlight
  semantics (typing into the box, Cmd/Ctrl+click); the ephemeral blink stays mode-free.
- No database changes — the `db.json` / `db_lite.json` Release assets from v2.3 are still
  valid; v2.4 ships no new assets.

## v2.3 — Proper-Case Normalization & +6,421 Common Words

### Changed
- **Database normalized to Proper Case** — every word's first letter capitalized, while
  preserving acronyms (NASA), Roman numerals (XXXIII), and mixed-case brands (iPhone).
  ~60% of entries re-cased for consistent skimming. Only the 5 **case-sensitive** ciphers
  (Alphanumeric Case Sensitive, Capitals Added/Mixed, Reverse Caps Added/Mixed) change value;
  every other cipher lowercases input first, so their values are unaffected.

### Added
- **+6,421 common English words** filled in from the original Gematro 20K wordlist (short /
  no-vowel fragments dropped). **209,667 → 216,088 entries.**

### Tools
- `tools/normalize_caps.py` — the smart Proper-Case pass: dictionary-aware acronym detection,
  strict Roman-numeral + mixed-case preservation, digit/`[bracket]` passthrough. Reusable on
  any Gematro `db.txt`.

## v2.2 — Progressive Loading, Curated Default Loadout & 11 New Ciphers

### Added
- **Progressive database loading**: a small `db_lite.json` (the default cipher set) loads
  first for a ~2s first paint with immediate matching, then the full `db.json` streams in and
  swaps in the background — the full cipher set no longer gates first-paint time.
- **11 new ciphers** ported from Alektryon's fork (AGPLv3, attributed): the polygonal family
  (Pentagonal, Hexagonal, Heptagonal, Octagonal, Enneagonal, Decagonal), English Qabalah 31,
  Mars Kamea Gematria, Angelic Gematria, and Bacon Standard / Bacon R Standard — **now 95
  ciphers (80 English-applicable)**.
- **Configurable default loadout** — `config.js` `defaultEnabledCiphers` sets which ciphers
  are on at first load (and on "reset to defaults"); empty/omitted = the classic 4.
- **Built-in "Alphanumeric" category** grouping the alphanumeric family (Alphanumeric Qabbala,
  Synx, Alphanumeric Case Sensitive, Alphanumeric Primes/Trigonal/Squares/Halves).
- **"Base" preset** button (the classic 4) in the Cyphers menu.
- **Keyboard navigation** for the results modal (desktop): ↑/↓ page, ←/→ minimize/restore;
  typing snaps focus back to the phrase box.
- **db cache-busting** — `config.js` `databaseVersion` appends `?v=N` to the db fetch so an
  updated database isn't served stale from browser cache.

### Changed
- **Default match mode is now "Same Cipher Match"** (was "Cross Cipher Match") — tighter, more
  relevant results, especially with a larger default loadout.
- Cipher menu/grid order: the base four lead.

### Fixed
- Breakdown viewer defaulted to the stale name "English Ordinal" (renamed in v2.1) and opened
  on the wrong cipher — now defaults to "Ordinal".

### Tools
- `tools/generate_db_json.py` emits `db_lite.json` (the lite subset) alongside `db.json`.

## v2.1 — Database Restoration & Bug Fixes

### Added
- Database grown from ~145,800 to **209,667 curated entries**:
  - Specialty databases: Liber AL verses, Latin words, Roman numerals, spelled-out
    numbers/digits, and Illuminati/esoteric terms (~34k).
  - Restoration of ~20k entries that an earlier over-aggressive cleanup had removed,
    concentrated in the alphabet "ends" (A, B, C, X, Y, Z) plus O/U/T/I.
  - Recovery of ~7.7k Thelemic/Hermetic terms (Liber AL, CCRU/Numogram, Rosicrucian,
    Crowley mottos).

### Fixed
- **Case-sensitivity bug** (precomputed `db.json`): Capitals Added, Capitals Mixed,
  Reverse Caps Added/Mixed, and Alphanumeric Case Sensitive returned incorrect values
  for capitalized input. The cipher engine now respects the per-cipher case-sensitive flag.
- **Bracket-annotation bug**: entries with `[N]` display annotations (Roman numerals,
  number words) over-counted the bracketed digits in digit-aware ciphers (Alphanumeric
  Qabbala, Synx, Alphanumeric Primes, etc.). Annotations are now stripped before scoring,
  matching the live engine.
- **Match ordering**: the database is now alphabetically sorted, so newly added entries
  surface correctly in same-value match lists (previously appended entries were buried).

### Changed
- **Cipher names** (display only — values unchanged):
  - `Latin` → `Latin (Jewish)`, `Latin Ordinal` → `Latin Ordinal (Jewish Ord.)`,
    `Latin Reduction` → `Latin Reduction (Jewish Red.)`
  - `Alphanumeric Satanic` → `Alphanumeric Case Sensitive`
- **UI**: selecting/copying text from a result cell no longer minimizes the modal.

### Tools
- Added `tools/generate_db_json.py` (+ `tools/all_ciphers.py`) to rebuild the precomputed
  `db.json` from `db.txt`. See README.
