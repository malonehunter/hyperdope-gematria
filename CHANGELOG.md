# Changelog

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
