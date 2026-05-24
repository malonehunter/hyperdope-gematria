#!/usr/bin/env python3
"""
Complete cipher engine — parses ALL ciphers from ciphers.js and scores entries.
Only applies English-alphabet ciphers to English text (skips Hebrew, Greek, Arabic, Russian).
"""

import re
import json
import os


def parse_ciphers_js(filepath):
    """Parse ciphers.js and extract all cipher definitions."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Match each cipher constructor call
    # Pattern: new cipher("name", "category", hue, sat, light, [chars], [values], diacritics, enabled, caseSensitive)
    pattern = re.compile(
        r'new cipher\(\s*'
        r'"([^"]+)",\s*'       # name
        r'"([^"]+)",\s*'       # category
        r'[\d.]+,\s*'          # hue
        r'[\d.]+,\s*'          # saturation
        r'[\d.]+,\s*'          # lightness
        r'\[([^\]]+)\],\s*'    # characters array
        r'\[([^\]]+)\],\s*'    # values array
        r'(true|false)\s*,\s*' # diacritics
        r'(true|false)\s*,\s*' # enabled
        r'(true|false)\s*\)',  # case_sensitive
        re.DOTALL
    )

    ciphers = []
    for match in pattern.finditer(content):
        name = match.group(1)
        category = match.group(2)
        chars_str = match.group(3)
        vals_str = match.group(4)
        diacritics = match.group(5) == "true"
        enabled = match.group(6) == "true"
        case_sensitive = match.group(7) == "true"

        chars = [int(x.strip()) for x in chars_str.split(",") if x.strip()]
        vals = [int(x.strip()) for x in vals_str.split(",") if x.strip()]

        if len(chars) != len(vals):
            continue

        ciphers.append({
            "name": name,
            "category": category,
            "char_codes": chars,
            "values": vals,
            "char_map": dict(zip(chars, vals)),
            "diacritics": diacritics,
            "enabled": enabled,
            "case_sensitive": case_sensitive,
        })

    return ciphers


def filter_english_ciphers(ciphers):
    """Keep only ciphers that map standard English lowercase letters (a-z, codes 97-122).
    Skip Hebrew, Greek, Arabic, Russian ciphers."""
    skip_categories = {"Hebrew", "Greek", "Arabic", "Russian"}
    english_ciphers = []
    for c in ciphers:
        if c["category"] in skip_categories:
            continue
        # Check if this cipher maps at least a-z
        has_english = any(97 <= code <= 122 for code in c["char_codes"])
        if has_english:
            english_ciphers.append(c)
    return english_ciphers


def compute_value(text, cipher):
    """Compute gematria value of text using given cipher."""
    char_map = cipher["char_map"]
    total = 0
    for ch in text:
        lowered = ch.lower() if not cipher.get("case_sensitive") else ch
        if len(lowered) != 1:
            continue
        code = ord(lowered)
        if code in char_map:
            total += char_map[code]
    return total


# Singleton: loaded ciphers
_CIPHERS = None
_CIPHERS_PATH = os.path.join(os.path.dirname(__file__), "..", "calc", "ciphers.js")


def get_ciphers():
    global _CIPHERS
    if _CIPHERS is None:
        all_ciphers = parse_ciphers_js(_CIPHERS_PATH)
        _CIPHERS = filter_english_ciphers(all_ciphers)
    return _CIPHERS


def score_all_ciphers(text):
    """Score text against ALL English ciphers. Returns dict of cipher_name -> value."""
    ciphers = get_ciphers()
    return {c["name"]: compute_value(text, c) for c in ciphers}


def score_entry_full(text, hot_numbers=None):
    """Score entry with all ciphers and check against hot numbers.
    Returns dict with values, hits, and significance score."""
    values = score_all_ciphers(text)

    if hot_numbers is None:
        hot_numbers = DEFAULT_HOT_NUMBERS

    hits = {}
    significance = 0
    for cipher_name, val in values.items():
        if val in hot_numbers:
            tier = hot_numbers[val]
            if tier not in hits:
                hits[tier] = []
            hits[tier].append((cipher_name, val))
            significance += 10 if tier == "t1" else 3

    return {
        "values": values,
        "hits": hits,
        "significance": significance,
    }


# Will be updated after book extraction completes
DEFAULT_HOT_NUMBERS = {}
# Build from tiers
_T1 = {11, 13, 22, 26, 27, 33, 38, 39, 42, 47, 52, 58, 62, 66, 69, 73, 74,
       77, 88, 93, 99, 101, 108, 112, 119, 137, 147, 153, 156, 174, 187,
       201, 206, 216, 227, 260, 314, 322, 333, 351, 444, 555, 666, 777,
       888, 911, 999, 1776}
_T2 = {3, 5, 7, 9, 12, 17, 19, 23, 28, 30, 32, 35, 36, 37, 40, 44, 46,
       48, 49, 50, 51, 53, 55, 56, 57, 59, 60, 61, 63, 64, 65, 67, 68,
       70, 71, 72, 75, 76, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 89,
       90, 91, 92, 94, 95, 96, 97, 98, 100, 104, 105, 106, 107, 110,
       113, 116, 117, 118, 120, 121, 123, 128, 131, 133, 139, 142, 144,
       149, 150, 151, 155, 157, 159, 160, 163, 166, 169, 170, 173, 175,
       177, 180, 188, 189, 191, 193, 196, 199, 200, 203, 209, 211, 212,
       213, 218, 223, 229, 233, 239, 241, 243, 246, 249, 252, 253, 257,
       263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337,
       347, 349, 353, 359, 367, 373, 379, 383, 389, 397}

for n in _T1:
    DEFAULT_HOT_NUMBERS[n] = "t1"
for n in _T2:
    if n not in DEFAULT_HOT_NUMBERS:
        DEFAULT_HOT_NUMBERS[n] = "t2"


if __name__ == "__main__":
    ciphers = get_ciphers()
    print(f"Loaded {len(ciphers)} English-applicable ciphers:\n")
    for c in ciphers:
        print(f"  {c['name']:30s} [{c['category']}]")

    print(f"\n--- Sample scoring ---")
    test_words = ["God", "Masonry", "Jesus", "Freemason", "English", "Gematria",
                  "Bible", "asdfghjkl", "Climate Change Hoax"]
    for word in test_words:
        result = score_entry_full(word)
        # Show only the 4 base ciphers + any ciphers that hit hot numbers
        base = {k: v for k, v in result["values"].items()
                if k in ("Ordinal", "Reduction", "Reverse Ordinal", "Reverse Reduction")}
        base_str = ", ".join(f"{k}={v}" for k, v in base.items())
        hit_count = sum(len(v) for v in result["hits"].values())
        print(f"  {word:30s} sig={result['significance']:>3}  base:[{base_str}]  hot_hits={hit_count}")
