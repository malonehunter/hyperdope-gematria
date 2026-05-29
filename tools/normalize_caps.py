#!/usr/bin/env python3
"""Normalize a Gematro db.txt to Proper Case.

Rule (NetVoid's "capitalise first letter of every word, keep 3-letter agencies",
done smartly): capitalize the first letter of every word and lowercase the rest,
BUT preserve:
  - acronyms      e.g. NASA, FBI, BMX  (all-caps tokens that aren't dictionary words)
  - Roman numerals e.g. XXXIII, II, and lowercase mmxlvi -> MMXLVI
  - mixed-case     e.g. iPhone, eBay, McDonald (internal capitals)
  - digits / [bracket] annotations  -> left untouched

Only the 5 case-sensitive ciphers (Alphanumeric Case Sensitive, Capitals Added/Mixed,
Reverse Caps Added/Mixed) change value; every other cipher lowercases first.

Usage: python3 normalize_caps.py <in.txt> <out.txt> [--report]
Output is deduped (case-insensitive) and re-sorted (case-insensitive), matching the
db.txt invariants.
"""
import re
import sys
from pathlib import Path


def load_dict():
    try:
        return {w.strip().lower() for w in open("/usr/share/dict/words", errors="ignore") if w.strip()}
    except FileNotFoundError:
        return set()


DICT = load_dict()
ROMAN = re.compile(r"M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})", re.I)


def is_roman(s):
    return bool(s) and ROMAN.fullmatch(s) is not None


def xform_word(w):
    # digits / brackets: leave entirely alone (numbers, [N] annotations)
    if any(c.isdigit() for c in w) or "[" in w or "]" in w:
        return w
    letters = re.sub(r"[^A-Za-z]", "", w)
    if not letters:
        return w
    # mixed-case (an uppercase letter past the first, but NOT all-caps): preserve iPhone / eBay / McDonald
    if w != w.lower() and w != w.upper() and not (w[0].isupper() and w[1:] == w[1:].lower()):
        return w
    # all-caps multi-letter token
    if w == w.upper() and len(letters) >= 2:
        if is_roman(letters):
            return w                       # XXXIII -> keep
        if letters.lower() not in DICT:
            return w                       # NASA / FBI / BMX -> keep (acronym)
        # else: a real word shouted (BIG) -> fall through to Title Case
    # lowercase/mixed Roman numeral that isn't a real word: uppercase it (mmxlvi -> MMXLVI)
    if len(letters) >= 2 and is_roman(letters) and letters.lower() not in DICT:
        return w.upper()
    # normal word: Title Case
    return w[:1].upper() + w[1:].lower()


def xform(line):
    return " ".join(xform_word(w) for w in line.split())


def main():
    inp, outp = Path(sys.argv[1]), Path(sys.argv[2])
    report = "--report" in sys.argv[3:]
    lines = [l.rstrip("\r\n") for l in open(inp, encoding="utf-8")]
    header = lines[0] if lines and "GEMATRO" in lines[0].upper() else None
    body = [l for l in (lines[1:] if header else lines) if l.strip()]

    out = [xform(l) for l in body]
    changed = [(a, b) for a, b in zip(body, out) if a != b]

    # case-insensitive dedup (collapses any case-variants merged by the transform) + re-sort
    seen = {}
    for o in out:
        seen.setdefault(o.lower(), o)
    dedup = sorted(seen.values(), key=lambda s: s.lower())
    removed = len(out) - len(dedup)

    with open(outp, "w", encoding="utf-8") as f:
        if header:
            f.write(header + "\n")
        f.write("\n".join(dedup) + "\n")

    print(f"dict words: {len(DICT):,}")
    print(f"in={len(body):,}  changed={len(changed):,} ({len(changed)/len(body)*100:.0f}%)  "
          f"case-dups removed={removed:,}  out={len(dedup):,}")

    if report:
        import random
        print("\n--- rule demo (hardcoded) ---")
        for s in ["NASA conspiracy", "World War II", "xxxiii", "mmxlvi", "iPhone",
                  "the FBI and CIA", "a BIG WIN for US", "a bmx god", "eBay", "apple"]:
            print(f"    {s!r:22} -> {xform(s)!r}")
        print("\n--- 18 real before -> after (changed entries) ---")
        random.seed(5)
        for a, b in random.sample(changed, 18):
            print(f"    {a!r}\n      -> {b!r}")
        # protection counts
        kept_acro = sum(1 for l in dedup for w in l.split()
                        if w == w.upper() and len(re.sub(r"[^A-Za-z]", "", w)) >= 2
                        and not is_roman(re.sub(r"[^A-Za-z]", "", w)))
        kept_roman = sum(1 for l in dedup for w in l.split()
                         if w == w.upper() and is_roman(re.sub(r"[^A-Za-z]", "", w)) and len(w) >= 2)
        print(f"\n  all-caps acronym tokens preserved: {kept_acro:,}")
        print(f"  all-caps Roman-numeral tokens:     {kept_roman:,}")


if __name__ == "__main__":
    main()
