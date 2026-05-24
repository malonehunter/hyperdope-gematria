# Tools

## Rebuilding the precomputed database (`db.json`)

The calculator works out of the box in **live mode** — it loads `db.txt` (one phrase per
line) and computes cipher values on the fly. For **instant matching** (~100ms vs 2–5s per
query), it can instead load a precomputed `db.json` containing all 69 cipher values per entry.

`db.json` is a build artifact derived from `db.txt` + `calc/ciphers.js`. It is not committed
to the repo (it's large). Two ways to get it:

1. **Download** the prebuilt `db.json` from the latest
   [GitHub Release](https://github.com/malonehunter/hyperdope-gematria/releases/latest).
   Place it next to `index.html`.
2. **Regenerate** it yourself:

   ```sh
   python3 tools/generate_db_json.py db.txt db.json
   ```

   Requires Python 3. Reads cipher definitions from `calc/ciphers.js`, scores every entry in
   `db.txt` against all 69 English-applicable ciphers, and writes `db.json`.

The calculator auto-detects `db.json` (see `databaseMode` in `config.js`, default `"auto"`):
it tries `db.json` first and falls back to `db.txt` if absent.

## Files
- `generate_db_json.py` — builds `db.json` from a flat `db.txt`.
- `all_ciphers.py` — parses `calc/ciphers.js` and scores text against all English ciphers
  (used by the generator). Handles case-sensitive ciphers and strips `[...]` display
  annotations before scoring, matching the live engine.
