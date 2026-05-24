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
    { name: "CCRU", ciphers: ["Alphanumeric Qabbala", "Synx", "Keypad"] },
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

**209,667 curated entries** — cleaned, enriched, and restored from the original user-search database.

- Specialty sets (Liber AL, Latin, Roman numerals, spelled-out numbers, Illuminati/esoteric terms)
- Restoration of ~20k entries an earlier over-aggressive cleanup had removed (concentrated at the alphabet "ends" — A/B/C/X/Y/Z)
- ~7.7k recovered Thelemic/Hermetic terms (CCRU/Numogram, Crowley, Rosicrucian)
- See [CHANGELOG.md](CHANGELOG.md) for the full v2.1 breakdown

### Pre-computed Mode (instant matching)

Out of the box the calculator runs in **live mode** — it loads `db.txt` and computes cipher values on the fly (works immediately, ~2-5s per query). For **instant matching** (~100ms), use the pre-computed `db.json`:

- **Download** the prebuilt `db.json` from the [latest release](https://github.com/malonehunter/hyperdope-gematria/releases/latest) and drop it next to `index.html`, **or**
- **Rebuild** it from `db.txt`: `python3 tools/generate_db_json.py db.txt db.json`

The calculator auto-detects `db.json` (tries it first, falls back to `db.txt`) — see `databaseMode` in `config.js` (default `"auto"`). No code changes needed.

### Adding Entries

Append phrases as new lines to `db.txt`. File must start with `CREATE_GEMATRO_DB`.

## Features

- 85 ciphers (69 English + Hebrew, Greek, Arabic, Russian)
- Pre-computed instant matching via db.json
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

MIT
