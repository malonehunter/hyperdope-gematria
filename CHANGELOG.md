# Changelog

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
