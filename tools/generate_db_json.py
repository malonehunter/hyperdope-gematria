#!/usr/bin/env python3
"""Generate db.json (HYPER_CYPHERS v2) from a flat db.txt.

Computes all 69 English-applicable ciphers per entry and emits the JSON shape
the calculator's loadPrecomputedDB() expects.

Usage:
  python3 generate_db_json.py [input.txt] [output.json]

Defaults: db_track_a.txt -> db_track_a.json
"""
import json
import re
import sys
import time
from datetime import date
from pathlib import Path

from all_ciphers import get_ciphers, compute_value

# Lite db.json cipher subset for progressive first-paint. MUST stay in sync with
# production config.js `defaultEnabledCiphers` (the default 16-cipher loadout).
LITE_CIPHERS = [
    "Ordinal", "Reduction", "Reverse Ordinal", "Reverse Reduction",
    "Standard", "Latin (Jewish)", "English Sumerian", "Satanic Gematria",
    "Bacon Simple", "Septenary", "Chaldean (Cheiro)", "Primes",
    "Alphanumeric Qabbala", "Synx", "Alphanumeric Case Sensitive", "English Qaballa",
]


def main():
    in_path = Path(sys.argv[1] if len(sys.argv) > 1 else "db_track_a.txt")
    out_path = Path(sys.argv[2] if len(sys.argv) > 2 else "db_track_a.json")

    print(f"Input:  {in_path}")
    print(f"Output: {out_path}")

    ciphers = get_ciphers()
    cipher_order = [c["name"] for c in ciphers]
    print(f"Computing {len(ciphers)} ciphers per entry...")

    entries = []
    with open(in_path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i == 0:
                continue  # skip CREATE_GEMATRO_DB header
            line = line.rstrip("\r\n").strip()
            if not line:
                continue
            entries.append(line)

    n = len(entries)
    print(f"Entries to score: {n}")

    t0 = time.time()
    data = []
    for idx, phrase in enumerate(entries):
        # Match the live engine (gematria.js:23, optAllowPhraseComments=true): strip [...]
        # annotations before computing so digit-counting ciphers (AQ/Synx/etc.) don't count
        # bracketed display digits. Display text (row[0]) keeps the brackets.
        compute_text = re.sub(r"\[.+\]", "", phrase).strip() or phrase
        row = [phrase] + [compute_value(compute_text, c) for c in ciphers]
        data.append(row)
        if (idx + 1) % 10000 == 0:
            elapsed = time.time() - t0
            rate = (idx + 1) / elapsed
            eta = (n - idx - 1) / rate
            print(f"  {idx + 1:>7}/{n} ({(idx+1)/n*100:5.1f}%)  rate={rate:.0f}/s  eta={eta:.0f}s")

    out = {
        "version": 2,
        "format": "HYPER_CYPHERS",
        "generated": date.today().isoformat(),
        "entries": n,
        "cipher_order": cipher_order,
        "data": data,
    }

    print(f"Writing JSON...")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))

    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"Done. {n} entries, {size_mb:.1f} MB, {time.time()-t0:.0f}s total")

    # --- lite db.json: only LITE_CIPHERS columns, for progressive first-paint ---
    missing = [c for c in LITE_CIPHERS if c not in cipher_order]
    if missing:
        print(f"WARNING: LITE_CIPHERS not in cipher_order (skipped): {missing}")
    lite_idx = [cipher_order.index(c) for c in LITE_CIPHERS if c in cipher_order]
    lite_order = [cipher_order[i] for i in lite_idx]
    lite_data = [[row[0]] + [row[i + 1] for i in lite_idx] for row in data]
    lite_out = {
        "version": 2,
        "format": "HYPER_CYPHERS",
        "tier": "lite",
        "generated": date.today().isoformat(),
        "entries": n,
        "cipher_order": lite_order,
        "data": lite_data,
    }
    lite_path = out_path.with_name(out_path.stem + "_lite" + out_path.suffix)
    with open(lite_path, "w", encoding="utf-8") as f:
        json.dump(lite_out, f, separators=(",", ":"))
    lite_mb = lite_path.stat().st_size / 1024 / 1024
    print(f"Lite: {len(lite_order)} ciphers -> {lite_path.name}, {lite_mb:.1f} MB")


if __name__ == "__main__":
    main()
