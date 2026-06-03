# Cypher Calculator

A gematria cypher calculator with pre-computed instant matching, 209k+ curated word database, and full whitelabel support via `config.js`.

**[Try it live →](https://cypher.hyperdope.com)**

![Cypher Calculator](res/preview.png)

## Quick Start

```bash
git clone https://github.com/malonehunter/hyperdope-gematria.git
cd hyperdope-gematria

# Create your config (gitignored — won't be overwritten by updates)
cp config.default.js config.js
# Edit config.js — change siteName, colors, links, credits, etc.

# Serve locally (web server required for database loading)
python3 -m http.server 8000
# Open http://localhost:8000
```

> **Note:** Must run from a web server (not `file://`) due to browser CORS restrictions. VS Code Live Server extension also works.

## Customization

All branding lives in `config.js`. Copy `config.default.js` to `config.js` and edit:

```javascript
var CALC_CONFIG = {
  siteName: "My Calculator",               // logo text
  siteTitle: "My Calculator — Gematria",   // browser tab title
  logoColor: "hsl(148, 60%, 45%)",         // green like the code rain
  logoHoverMatrix: true,                   // matrix font hover on logo letters
  aboutLinks: [
    { text: "My Site", url: "https://example.com" },
  ],
  credits: [
    { name: "Your Name", role: "Fork maintainer" },
  ],
  // Custom cipher category groupings
  customCategories: [
    { name: "Favorites", ciphers: ["Ordinal", "Reduction", "Alphanumeric Qabbala"] },
  ],
  // See config.default.js for all options
};
```

`config.js` is in `.gitignore` — your customizations survive `git pull`.

## Updating

```bash
git pull origin master
# Your config.js is safe (gitignored)
# db.txt updates improve matches automatically
```

## Database

**229,943 curated entries** (Proper-Case normalized) — cleaned, enriched, restored from the original user-search database, and extended with NetVoid's 2026 manual review additions.

- Proper-Case normalization with acronym / Roman-numeral / mixed-case protection (see `tools/normalize_caps.py`), plus +6,421 common words from the original 20K wordlist (v2.3)
- Specialty sets (Liber AL, Latin, Roman numerals, spelled-out numbers, Illuminati/esoteric terms)
- Restoration of ~20k entries an earlier over-aggressive cleanup had removed (concentrated at the alphabet "ends" — A/B/C/X/Y/Z)
- ~7.7k recovered Thelemic/Hermetic terms (CCRU/Numogram, Crowley, Rosicrucian)
- See [CHANGELOG.md](CHANGELOG.md) for the full v2.1 breakdown

### Pre-computed Mode (instant matching + progressive loading)

Out of the box the calculator runs in **live mode** — it loads `db.txt` and computes cipher values on the fly (works immediately, ~2-5s per query). For **instant matching** (~100ms), use the pre-computed JSON:

- **Download** the prebuilt **`db.json` and `db_lite.json`** from the [latest release](https://github.com/malonehunter/hyperdope-gematria/releases/latest) (both files are attached to every tagged release, even when the database itself didn't change) and drop them next to `index.html`, **or**
- **Rebuild** both from `db.txt`: `python3 tools/generate_db_json.py db.txt db.json` (emits `db.json` + `db_lite.json`).

With both present, the calculator **loads progressively**: `db_lite.json` (the default ciphers) paints in ~2s with immediate matching, then the full `db.json` streams in and swaps in the background. It auto-detects them (see `databaseMode` / `databaseLiteJsonUrl` in `config.js`). Bump `databaseVersion` in `config.js` whenever you update the databases to cache-bust browsers.

### Adding Entries

Append phrases as new lines to `db.txt`. File must start with `CREATE_GEMATRO_DB`.

## Features

- 95 ciphers (80 English-applicable + Hebrew, Greek, Arabic, Russian)
- Progressive pre-computed matching (fast lite first paint, full set in the background)
- Configurable default cipher loadout + Base/Default/All presets
- Desktop keyboard nav for the results modal (arrows page / minimize)
- Auto-match on Enter (configurable toggle)
- Escape closes modal / clears filter
- Mobile optimized (keyboard dismisses, touch minimize)
- 10 calculator themes
- Custom cipher categories via config
- Matrix font hover effect
- History table with highlighting and export
- Date calculator, word breakdown, screenshots
- Drag & drop file import

## File Structure

```
├── index.html          # Main page
├── config.js           # Your config (gitignored)
├── config.default.js   # Template — copy to config.js
├── db.txt              # 145k word matching database
├── calc/               # Calculator JS + CSS
├── theme/              # 10 color themes
├── font/               # Matrix, Montserrat, Roboto Mono
└── res/                # Favicon, logos, assets
```

## Acknowledgments

- **Saun-Virroco** — Original Gematro creator
- **[NetVoid](https://cyphers.news/)** — Preserved codebase & database, v2 cleanup help
- **[Alektryon](https://github.com/Alektryon)** — Cipher contributions & reviews
- **[Hyperdope](https://hyperdope.com)** — Database overhaul, v2 architecture

## Contact

[@LNHyper on X](https://twitter.com/lnhyper) · hyperdopeofficial@protonmail.com

## License

This project is licensed under the **GNU General Public License v2.0** — see [`LICENSE`](LICENSE).

It builds on the original Gematro project (open-source; the original repository has since been deleted, so the exact upstream license isn't independently verifiable — this fork adopted **GPLv2** when first enhanced and published). It also incorporates 11 ciphers ported from [Alektryon's fork](https://github.com/Alektryon/gematria), released under the **GNU Affero General Public License v3.0 (AGPLv3)** and attributed in `CHANGELOG.md` and `calc/ciphers.js`. Because it incorporates AGPL (copyleft) code, the combined work is distributed under copyleft terms and is **not** MIT-licensed.
