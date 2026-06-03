#!/usr/bin/env python3
"""Classify gematria-db candidate entries: keep vs drop, with bucket + reason.

Calibrated against the NetVoid 2026 manual-curation cross-check, which exposed the
older dict-ratio / has-digit / camel-mash rules over-flagging modern proper nouns,
brands, acronyms, and event phrases like 'COVID-19 Policy' or 'Donald Trump 2024'.

This filter is intentionally permissive on real-world entries (anything with a
proper-noun signal, any dict word, any digit, OR reasonable structure) and only
hard-drops the patterns both independent curation passes (ours + NetVoid's) agreed
were junk.

Usage:
    python3 classify_candidates.py <input.txt> [--out <decisions.jsonl>] [--keep-list <keeps.txt>]

Input: one entry per line. Header line is auto-detected and skipped if it starts
with "CREATE_GEMATRO" or "GEMATRO_DB;" (Derek CSV — first column taken).

Output: prints bucket summary to stdout. Optional --out emits one JSON per line.
Optional --keep-list emits just the kept entries (one per line, no header).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def load_dict() -> set[str]:
    for p in ("/usr/share/dict/words", "/etc/dictionaries-common/words"):
        try:
            with open(p, encoding="utf-8", errors="ignore") as f:
                return {w.strip().lower() for w in f if w.strip()}
        except FileNotFoundError:
            continue
    return set()


DICT = load_dict()

# ---- patterns ----
NON_ASCII = re.compile(r"[^\x00-\x7f]")
# True non-English-script (no ASCII letters at all)
ASCII_LETTERS_RE = re.compile(r"[A-Za-z]")
MONTH = r"(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)"
ORDINAL = r"(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)"
NUMBER_WORD = r"(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|and)"

# A "pure date" — calendar wording + REQUIRES a 4-digit year (so 'January 6' / 'April 1st'
# keep their cultural-reference meaning; 'June 28 1969' / 'February twenty eighth 1975' drop).
PURE_DATE_RE = re.compile(
    rf"^\s*(?:{MONTH})(?:\s+(?:\d{{1,2}}|{ORDINAL}|{NUMBER_WORD}))*(?:\s*(?:st|nd|rd|th))?\s+\d{{4}}\s*$",
    re.I,
)

# Pure spelled number (no other content). Optional [N] annotation kept = our convention.
SPELLED_NUMBER_RE = re.compile(
    rf"^\s*(?:{NUMBER_WORD}\s*)+(?:\[\d+\])?\s*$",
    re.I,
)

# Pure numeric (year, code, etc.) — usually meaningful in gematria context
PURE_NUMERIC_RE = re.compile(r"^\s*[\d\s/.\-:]+\s*(?:\[\d+\])?\s*$")

# All-caps short fragment — specifically the "A Z" / "B P" / "F O Y" single-letter-and-space pattern.
# Tightened: must be SINGLE letters separated by spaces. 'KSI', 'LMK', 'AC DC' all survive.
ALLCAPS_TINY_RE = re.compile(r"^[A-Z](?:\s+[A-Z])+$")

# Long consonant run within a SINGLE word (10+ consecutive consonants) = keyboard mash.
# Per-word check below avoids false positives like 'Music Industry Symbolism'.
LONG_CONSONANT_RE = re.compile(r"[bcdfghjklmnpqrstvwxyz]{10,}", re.I)

VOWELS = set("aeiouy")


def letters_only(s: str) -> str:
    return re.sub(r"[^A-Za-z]", "", s)


def has_proper_noun_signal(words: list[str]) -> bool:
    """At least one capitalized, 3+ letter word with a vowel (e.g., 'Palantir', 'Netanyahu')."""
    for w in words:
        a = letters_only(w)
        if len(a) >= 3 and a[0].isupper() and any(c.lower() in VOWELS for c in a):
            return True
    return False


def has_dict_word(words: list[str], min_len: int = 2) -> bool:
    """Has at least one English dictionary word. min_len=2 keeps 'is', 'an', 'to', 'by' as signals.
    Single-character words ('a', 'i') still excluded.
    """
    for w in words:
        a = letters_only(w).lower()
        if len(a) >= min_len and a in DICT:
            return True
    return False


def classify(entry: str) -> dict:
    """Return {classification, keep, reason}. Pure function, deterministic."""
    raw = entry.rstrip()
    if not raw.strip():
        return {"classification": "empty", "keep": False, "reason": "empty"}

    # 1. PURELY non-ASCII (zero ASCII letters) = wrong db for English ciphers.
    # Entries with diacritics (Beyoncé, Oñaz, Æ) survive because they have ASCII letters too.
    if NON_ASCII.search(raw) and not ASCII_LETTERS_RE.search(raw):
        return {
            "classification": "non-ascii-only",
            "keep": False,
            "reason": "entry has no ASCII letters (foreign script only)",
        }

    words = raw.split()
    nw = len(words)
    letters = letters_only(raw)

    # 2. tiny fragment: ≤2 letters AND all-lowercase AND no digits.
    # Catches 'aa', 'bb', 'cd' (mash); preserves 'YO', 'IQ', 'TF' (uppercase = intent),
    # '4G', 'WW3', '3/11' (digits = intent), 'Yu' (mixed-case = name).
    if (len(letters) <= 2
        and raw == raw.lower()
        and not any(c.isdigit() for c in raw)):
        return {
            "classification": "tiny-fragment",
            "keep": False,
            "reason": f"all-lowercase ≤2 letters, no digits — likely fragment",
        }

    # 3. all-caps single-letter pair pattern ('A Z', 'B P', 'F O Y') — not 3-letter acronyms
    if ALLCAPS_TINY_RE.match(raw):
        return {
            "classification": "allcaps-tiny",
            "keep": False,
            "reason": "single-letter-spaces pattern (e.g. 'A Z', 'B P')",
        }

    # 4. short + no vowels + ALL-LOWERCASE + no digits = real keyboard mash.
    # ('scr', 'wkqz' drop; 'LMK', 'xQc', 'WW3', '4G' survive because case/digits signal intent.)
    if (len(letters) <= 5
        and letters
        and not any(c.lower() in VOWELS for c in letters)
        and raw == raw.lower()
        and not any(c.isdigit() for c in raw)):
        return {
            "classification": "no-vowel-mash",
            "keep": False,
            "reason": "all-lowercase ≤5 letters with no vowels (keyboard mash)",
        }

    # 5. long consonant run WITHIN A SINGLE WORD (10+ consecutive) = keyboard mash.
    # Per-word check avoids cross-word false-positives like 'Music Industry Symbolism'.
    for w in words:
        if LONG_CONSONANT_RE.search(letters_only(w)):
            return {
                "classification": "consonant-run",
                "keep": False,
                "reason": f"single word with 10+ consonants ({w!r})",
            }

    # 6. same word repeated 3+ times ("Jew Jew Jew Jew Jew")
    if nw >= 3 and len({w.lower() for w in words}) == 1:
        return {
            "classification": "repeated-word",
            "keep": False,
            "reason": f"same word x{nw}",
        }

    # 7. pure-date constructions (whole entry is just a calendar date)
    if PURE_DATE_RE.match(raw):
        return {
            "classification": "pure-date",
            "keep": False,
            "reason": "entry is only a calendar date",
        }

    # 8. pure spelled-number entries — keep if [N] annotated (our convention), drop bare
    if SPELLED_NUMBER_RE.match(raw):
        if "[" in raw and "]" in raw:
            return {
                "classification": "spelled-number-annotated",
                "keep": True,
                "reason": "spelled number with [N] annotation (our convention)",
            }
        return {
            "classification": "spelled-number-bare",
            "keep": False,
            "reason": "bare spelled number with no [N] annotation or context",
        }

    # 9. pure numeric (year/code) — almost always meaningful in gematria
    if PURE_NUMERIC_RE.match(raw):
        return {
            "classification": "numeric",
            "keep": True,
            "reason": "pure numeric (year, code, date — usually meaningful)",
        }

    # 10. long scraped sentence (≥15 words AND low real-word density)
    if nw >= 15:
        dict_hits = sum(
            1 for w in words if (a := letters_only(w).lower()) and len(a) >= 3 and a in DICT
        )
        if dict_hits < nw * 0.4:
            return {
                "classification": "long-scraped",
                "keep": False,
                "reason": f"long sentence (nw={nw}) with low dict density ({dict_hits} dict words)",
            }
        return {
            "classification": "long-content",
            "keep": True,
            "reason": f"long sentence (nw={nw}) with real content",
        }

    # 11. final signal test: any of {dict word, proper-noun pattern, digit, uppercase letter}.
    # An uppercase letter = intentional capitalization = signal of intent.
    # ('AC DC' = band, 'KSI' = name, 'IOU' = abbr — all have uppercase so all survive.)
    has_d = has_dict_word(words)
    has_p = has_proper_noun_signal(words)
    has_n = any(c.isdigit() for c in raw)
    has_u = any(c.isupper() for c in raw)

    if not (has_d or has_p or has_n or has_u):
        return {
            "classification": "no-signal",
            "keep": False,
            "reason": "no dict words, no proper-noun, no digits, no uppercase — likely junk",
        }

    # default: keep
    return {
        "classification": "keep",
        "keep": True,
        "reason": "passes filter",
    }


def load_entries(path: Path) -> list[str]:
    """Auto-detect Gematro header + CSV format; return list of phrase strings."""
    out: list[str] = []
    with open(path, encoding="utf-8", errors="replace") as f:
        first: str | None = None
        for i, line in enumerate(f):
            line = line.rstrip("\r\n")
            if i == 0:
                first = line
                if line.upper().startswith("CREATE_GEMATRO") or line.startswith("GEMATRO_DB;"):
                    continue  # header, skip
                if line.strip():
                    out.append(line)
            else:
                if line.strip():
                    if first and first.startswith("GEMATRO_DB;"):
                        out.append(line.split(";")[0])
                    else:
                        out.append(line)
    return out


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0

    inp = Path(argv[0])
    out_path: Path | None = None
    keep_path: Path | None = None

    i = 1
    while i < len(argv):
        if argv[i] == "--out" and i + 1 < len(argv):
            out_path = Path(argv[i + 1])
            i += 2
        elif argv[i] == "--keep-list" and i + 1 < len(argv):
            keep_path = Path(argv[i + 1])
            i += 2
        else:
            i += 1

    entries = load_entries(inp)
    decisions: list[dict] = []
    keeps: list[str] = []
    buckets: dict[str, int] = {}

    for e in entries:
        d = classify(e)
        d["entry"] = e
        decisions.append(d)
        buckets[d["classification"]] = buckets.get(d["classification"], 0) + 1
        if d["keep"]:
            keeps.append(e)

    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            for d in decisions:
                f.write(json.dumps(d, ensure_ascii=False) + "\n")
    if keep_path:
        with open(keep_path, "w", encoding="utf-8") as f:
            f.write("\n".join(keeps) + "\n")

    n = len(entries) or 1
    kept = len(keeps)
    dropped = n - kept
    print(f"input: {len(entries):,}  keep: {kept:,} ({kept/n*100:.1f}%)  drop: {dropped:,} ({dropped/n*100:.1f}%)")
    print("by classification:")
    for b, c in sorted(buckets.items(), key=lambda x: -x[1]):
        marker = "+" if classify_returns_keep_for_bucket(b, decisions) else "-"
        print(f"  {marker} {c:>7,}  {b}")
    return 0


def classify_returns_keep_for_bucket(bucket: str, decisions: list[dict]) -> bool:
    """Whether this bucket recommends keep (for stdout summary marker)."""
    for d in decisions:
        if d["classification"] == bucket:
            return d["keep"]
    return False


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
