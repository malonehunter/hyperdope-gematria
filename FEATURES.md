# Cyphers — complete feature inventory

A rebuild specification for the calculator as it stands at build `20260808d`.

Every feature listed here is **live in the current build**. Matching, the paid
tier, the LLM integration and the social feed were removed and are deliberately
absent — this is what exists, not what was ever planned.

Counts were taken from the running application, not estimated from source:
**169 ciphers across 15 categories**, 42 persisted settings, 7 membership tabs,
23 database tables, 58 database functions, 10 themes.

---

## 1. Core calculation engine

The heart of the tool. Everything else is presentation.

- **Cipher object model** — a cipher is a name, a category, an HSL colour, a
  character array, a value array, and four behaviour flags (diacritics on/off,
  enabled, case-sensitive, and a per-cipher override).
- **Character-to-value mapping** — arbitrary Unicode characters map to
  arbitrary numeric values, which is what allows non-Latin scripts to work at
  all rather than being transliterated first.
- **Diacritics handling** — per-cipher choice between treating `é` as `e` or as
  its own character. Both are correct depending on the language.
- **Case sensitivity** — per-cipher flag. Most ciphers fold case; a few must not.
- **Substitution mode** (`optGemSubstitutionMode`) — alternate calculation
  where characters substitute rather than sum.
- **Multi-character position modes** (`optGemMultCharPos`,
  `optGemMultCharPosReverse`) — positional weighting, forward and reversed.
- **Calculation method switch** (`optNumCalcMethod`) — the global sum strategy.

## 2. Cipher library — 169 ciphers, 15 categories

Category order is deliberate and should be preserved:

| Category | Count | Notes |
|---|---:|---|
| English | 5 | Ordinal, Reduction and relatives |
| Reverse | 12 | |
| Gematria | 16 | |
| CCRU | 4 | Numogram / Cybernetic Culture Research Unit |
| Alphanumeric | 7 | |
| Conspiracy | 3 | |
| Cryptography | 8 | |
| Extra | 20 | sourced from dekoda.co |
| Maths | 24 | largest maths group |
| Archaic | 7 | |
| Thelemic | 4 | |
| Languages | 31 | largest overall — international scripts |
| Latin | 10 | |
| Hebrew | 8 | |
| Greek | 10 | |

**Default enabled set is exactly four:** Ordinal, Reduction, Reverse Ordinal,
Reverse Reduction. This matters — "Default" is a fixed base-4, not "whatever
was on last time". Getting this wrong makes every restore path reset the user's
selection.

### Cipher selection UI
- Category column with hover-to-preview, click-to-toggle-whole-category
- **Search across all categories at once**, with the matched run bolded and the
  source category shown beside each name. Searching only the open category
  would be worse than no search.
- Quick-set buttons: **Empty / Default / All (EN) / All**
- Per-cipher checkboxes that stay in sync with search results
- Touch devices get an explicit "Toggle Category" button (no hover on mobile)
- Long category names get a smaller face rather than being clipped

### Cipher editing
- **Edit Ciphers** panel — create, modify and delete custom ciphers
- Per-cipher colour assignment, with random colour generation for new ciphers
- Coloured cipher display toggle (`optColoredCiphers`)

## 3. Input and history table

- Phrase input box with live calculation
- **History table** — every phrase calculated, one row per phrase, one column
  per enabled cipher
- **Editable table caption** (`optHistTableCaption`)
- New phrases to top or bottom (`optNewPhrasesGoFirst`)
- Phrase comments (`optAllowPhraseComments`)
- Phrase limit cap (`optPhraseLimit`)
- Letter and word count column (`optLetterWordCount`)
- Clear history
- Right-click context menu on table cells
- Two-column forced layout option (`optForceTwoColumnLayout`)

## 4. Word breakdown and cipher chart

- **Word breakdown** (`optWordBreakdown`) — per-letter values for the current
  phrase, shown letter by letter
- **Compact breakdown** (`optCompactBreakdown`) — condensed variant
- **Long breakdown** builder for multi-word phrases
- **Cipher chart** (`optShowCipherChart`) — bar chart of the phrase across
  every enabled cipher
- **Gradient charts** (`optGradientCharts`)
- Chart auto-fit to available width
- Gematria card view

## 5. Find Matches and highlighting

- **Cross-cipher match** (`optFiltCrossCipherMatch`) — phrase A in cipher X
  equals phrase B in cipher Y
- **Same-cipher match** (`optFiltSameCipherMatch`)
- **Show only matching** (`optShowOnlyMatching`) — hides non-matching rows
- **Numerology mode** (`optNumerologyMode`)
- Match ordering with **Reset Order**
- Automatic highlight of matching values across the table
- Manual cell highlight toggle by click
- Zero-value highlight removal
- Match count display
- **Enter As Words** input mode
- Visual flash effect when matches are found

## 6. Number properties

For any calculated value, on demand:

- Prime check
- Factorization
- Divisors
- Triangular number check
- Fibonacci check
- Permutations
- Number bases conversion
- Roman numerals
- Numerology reduction
- **Tic Xenotation** (CCRU notation)

## 7. Word database

- **Autoloading phrase database** from `db.txt` at startup
- Live database mode (`liveDatabaseMode`)
- Database search with query box
- Pagination — phrases per page (`dbPageItems`), scroll step (`dbScrollItems`)
- Minimisable database panel
- Clear query / unload database
- **Create Database (TXT)** — export a new database file
- Export DB query results to CSV

## 8. Date calculator

- Two-date duration calculation
- Named/described dates (both dates take a label)
- **Add/Subtract** mode with year / month / week / day offsets
- Exclude start date / include end date toggles
- Month-level granularity
- Reset all dates
- Duration output printable as an image

## 9. Astrology

A full ephemeris implementation, not a lookup table.

- **Planetary position calculation** from orbital elements — heliocentric and
  geocentric, including Pluto (which needs its own series)
- Sun rectangular coordinates, obliquity, local sidereal time
- **House systems** with a selectable system, and house assignment per planet
- Sign assignment per planet
- **Moon phase**
- Aspect calculation with colour-coded aspect lines
- **2D chart wheel** — canvas rendered
- **3D chart view** — projected, with orbit paths
- **Zoom and pan** on the 3D view, including scroll-wheel zoom that does not
  scroll the page
- Reset view
- **Birth location lookup** via OpenStreetMap / Nominatim address search
- Manual coordinate entry as an alternative to search
- "Set to now" for transits
- **Noon fallback** — without a birth time, houses and Ascendant are suppressed
  rather than silently wrong
- Send chart values to the phrase box (feeds astrology into gematria)
- Chart printable as an image

## 10. Encoding / phrase finder

Reverse lookup: given target values, find phrases that produce them.

- Configurable alphabet, vowels, and excluded letters
- **Find Phrases** against the loaded database
- Use database with 1 phrase or 2 phrases
- **Syllable mode** with a max-phrases cap
- Odd length filter
- Read values / subtract values
- Clear values only, reset all settings
- Encoding defaults persist (`encDefAlphArr`, `encDefVowArr`, `encDefExcLetArr`)

## 11. Export, import and print

**Image export** (via html2canvas), with an adjustable scale factor
(`optImageScale`):
- Print Cyphers Chart
- Print History Table
- Print Word Breakdown
- Print Cyphers Card
- Print Number Properties
- Print Date Durations
- Print Astrology Chart

**Data export/import:**
- Export History (CSV)
- Export Matches (TXT)
- Export DB Query (CSV)
- Export Settings (JS)
- Import File — settings, ciphers and history
- Switch Ciphers (CSV)
- Save / Load / Reset workspace

> **Security note for the rebuild:** the original import path used `eval()` on
> the imported file. It was replaced with a strict JSON-based deserialiser that
> validates argument count, types and array shape before constructing a cipher,
> and skips anything malformed with a console warning. The exporter also had to
> be fixed to JSON-escape cipher names, because unescaped names made the
> export→import round trip itself an injection channel. **Do not reintroduce
> `eval` in the importer.**

## 12. Code rain background

- **Four styles**: `matrix`, `new`, `retro`, `ccru`
- Three-state toggle (off / on / style cycling)
- **Density** slider
- **Speed** slider
- **Colour picker**, with the page background picking up the chosen colour once
  set by hand (`coderainColorPicked`)
- **Follow cipher colour** mode (`optCoderainFollowCipher`) — rain tracks the
  active cipher's hue instead of a fixed colour
- Japanese glyph set
- Reset to defaults

## 13. Theming and colour controls

- **10 packaged themes**: black, blue, green, green alt, red charcoal, teal,
  white, old book (normal / bright / dim)
- **Colour Controls panel** with live HSL sliders for three independent groups:
  - interface (`interfaceHue/Sat/Lit`)
  - font (`fontHue/Sat/Lit`)
  - code rain (`coderainHue/Sat/Lit`)
- Random colour generation for new ciphers
- Mobile-responsive layout throughout

## 14. Membership panel — 7 tabs

Opens in-page over the calculator. Tab order as shipped:

| Tab | Contents |
|---|---|
| ✅ **Presets** | Save, load, overwrite and delete named cipher selections |
| 📄 **CSV** | Save, load, download and delete CSV history snapshots server-side |
| 💾 **Saved** | Searchable saved entries; enable the cipher, reuse the phrase, or delete |
| 🏆 **Leaders** | Contributor leaderboard, sortable, grouped, with per-contributor phrase lists |
| 🔮 **Chart** | Saved birth charts, transits, place search, planets-at-birth |
| 📧 **Friends** | Friends, requests, discovery, privacy |
| ⚙ **Account** | Display name, avatar, account deletion |

### Phrase submission
- Submit a phrase to the shared database
- Cipher selection for the submission, with a defaulting rule
- Duplicate detection against the loaded database and against already-published
  phrases
- Withdraw a submission
- Two-step disarm/confirm on destructive actions

### Avatars
- Upload with client-side validation and shrinking before upload
- Remove
- Automatic cleanup of superseded avatar files (storage has no cascade)

## 15. Authentication

- Email + password sign-up and sign-in
- **Discord OAuth**, including linking Discord to an existing email account
- Email verification, with resend
- Password reset request and completion
- **Password strength meter** and problem reporting
- Friendly error translation (Supabase errors are not user-facing English)
- Route guards: `requireAuth()` and `redirectIfAuthed()`
- Post-login redirect targeting
- Pages: login, register, forgot password, reset password, profile
- **Code rain background on the auth pages**
- **First-run onboarding walkthrough** — welcome, display name, friend request
  policy, visibility, done. Runs once, marked on sight rather than on save.

## 16. Friends

- Send, cancel, accept and decline friend requests
- Friend list with sorting
- **Discover** — member search and suggestions
- Mutual friend counts
- Member profiles with stats and badges
- **Privacy controls** — who may send requests, and what is visible
- **Online presence** via heartbeat
- Unread/new badge counts with invalidation
- Role options and labels

## 17. Direct messages

- One-to-one conversations
- Threads list with unread totals
- History with pagination
- Mark read
- **Archive** a conversation
- **Clear** a conversation
- Block and unblock, with a blocked list
- **Report a member**, with reason and requested action
- Send-time pre-check

## 18. Moderation

- Word filter with rules, allowlist and settings tables (`mod_rules`,
  `mod_allow`, `mod_settings`)
- `mod_check()` applied to messages and any user-visible submitted text
- Two normalisation passes (`mod_norm_tight`, `mod_norm_words`) to catch
  spacing and substitution evasion
- Moderation event log
- **`moderate-message` edge function** — the one remaining serverless function

## 19. Admin panel

Separate page (`admin.html`), gated by `admin_require()`.

- Dashboard with live stats
- Online-now list
- **Reports queue** — filterable, sortable, with a detail view showing full
  context, and accept/reject decisions
- **User management** — search, sort, status changes, promote/demote admin,
  delete user, send password reset
- **Audit log** of every admin action
- Two-step disarm/confirm on destructive actions
- Admin badge rendering
- Deliberately does **not** expose user emails in listings

## 20. Backend — Supabase

**23 tables:** `profiles`, `history_entries`, `history_csv`, `workspaces`,
`presets`, `phrase_submissions`, `birth_charts`, `friendships`, `dm_pairs`,
`conversations`, `conversation_members`, `messages`, `blocks`, `reports`,
`mod_rules`, `mod_allow`, `mod_settings`, `moderation_events`, `admin_audit`,
`contact_messages`, `profile_role_options`, `posts`, `post_likes`.

> `posts` and `post_likes` are dropped by `20260808000000_remove_feed.sql` —
> they belonged to the removed feed. **Do not rebuild them.**

**58 database functions**, all `security definer` where they cross a privacy
boundary. **Row Level Security is on every table** — the anon key is public by
design, so RLS is the actual security boundary, not an extra layer.

**1 storage bucket:** `avatars`.

### Sync
- **History sync** — debounced, hash-compared so unchanged history is not
  rewritten, with status reporting. Reloading never clears history or resets the
  workspace; use the explicit right-click reset control to start over.
- **Workspace sync** — the full settings object, same hash-compare approach

## 21. Cross-cutting

- **localStorage persistence** of all 42 settings, restored on load
- **Settings export/import** as JS
- Reset to defaults
- **Quickstart guide** in-app
- About menu with project links, contacts and links to other calculators
- Contact form
- **Content Security Policy** on every page via `<meta http-equiv>`
  (GitHub Pages cannot set headers). `frame-ancestors` cannot be expressed this
  way and is the one directive that needs real hosting.
- **Cache-busting** — every local script and stylesheet carries `?v=BUILD`.
  Without it browsers serve stale JavaScript behind a fresh page, which is the
  single most confusing class of bug in this project's history.
- jQuery 3.7.1 and a vendored supabase-js; no build step, no package manager,
  no dependency manifest

---

## Rebuild notes worth carrying over

1. **No build step.** The entire app is static files opened directly by the
   browser. This is a feature — it can be self-hosted by copying a folder — and
   it constrains everything else.
2. **The word database needs a web server** to autoload, because of how
   browsers treat `file://`. Everything else works offline.
3. **Cache-busting is not optional.** Add it on day one.
4. **Never `eval` imported data.** See §11.
5. **RLS before features.** Every table needs a policy the moment it exists.
6. **Default cipher set is a fixed four**, not "whatever was enabled".
7. **Escape on output.** Cipher names, phrases, display names and captions all
   reach the DOM.
