#!/usr/bin/env python3
"""Evaluate mnemonic AA/EE/OO zero-onset doubles as diagnostic variants.

These variants deliberately reuse the fixed IEUAO auxiliary keys in onset
position.  They are therefore diagnostics, not legal 21x26 candidates: the
output records the expanded onset-key count and A/B overlap explicitly.
"""

from __future__ import annotations

import argparse
import itertools
import json
import os
import sys
from pathlib import Path

for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[variable] = "1"

import numpy as np  # noqa: E402


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replay", type=Path, required=True)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--benchmark-tools", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--ids", nargs="+", required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


ARGS = arguments()
REPLAY = ARGS.replay.resolve()
REPO = ARGS.repo.resolve()
INPUT = ARGS.input.resolve()
OUTPUT = ARGS.output.resolve()
sys.path[:0] = [str(REPLAY), str(ARGS.benchmark_tools.resolve())]
os.chdir(REPLAY)

import opt  # noqa: E402
import r10_search  # noqa: E402
import r9_search  # noqa: E402
from macroxue.engine import LAYOUT, SPEED, distance, pair  # noqa: E402
from shenyun_collision_benchmark import evaluate_layout, read_word_corpus  # noqa: E402


DATA = json.loads((REPLAY / "source.json").read_text(encoding="utf-8"))
PAYLOAD = json.loads(INPUT.read_text(encoding="utf-8"))
BY_ID = {row["id"]: row for row in PAYLOAD["candidates"]}
missing = set(ARGS.ids) - BY_ID.keys()
if missing:
    raise ValueError(f"missing input IDs: {sorted(missing)}")

KEYS = opt.META["keys"]
TONE_KEYS = tuple(KEYS.index(key) for key in "IEUAO")
ORDINARY = np.array(__import__("search_engine").ORD, dtype=np.int32)
CORPORA = json.loads((REPLAY / "R9_corpora.json").read_text(encoding="utf-8"))
TOKENS: list[int] = []
for token in CORPORA["daily"]["tokens"]:
    if "pinyin" not in token:
        continue
    head, final = r10_search.split(token["pinyin"])
    TOKENS.extend((r10_search.HEADS.index(head), 27 + opt.F.index(final)))
TOKENS_NP = np.array(TOKENS, dtype=np.int32)
PAIR_COST = np.array([[pair(a.lower(), b.lower()) for b in KEYS] for a in KEYS])
FIRST_COST = []
for key in KEYS:
    x, y, finger = LAYOUT[key.lower()]
    FIRST_COST.append((0.2 + (distance(finger, 1, x, y) if x < 5 else 0)) / SPEED[finger])
FIRST_COST_NP = np.array(FIRST_COST)


def read_two_word_codes(path: Path) -> set[str]:
    codes = set()
    active = False
    for raw in path.read_text(encoding="utf-8").splitlines():
        if raw.startswith("#"):
            active = raw.strip() == "# 二简词"
            continue
        if active and raw.strip():
            codes.add(raw.split()[0].upper())
    return codes


TWO_WORD_CODES = read_two_word_codes(REPO / "snow_sanpin.fixed.txt")


def daily_mx(state: np.ndarray) -> float:
    total = FIRST_COST_NP[state[TOKENS_NP[0]]]
    for index in range(1, len(TOKENS_NP)):
        total += PAIR_COST[state[TOKENS_NP[index - 1]], state[TOKENS_NP[index]]]
    return float(200 * (len(TOKENS_NP) // 2) / total)


def performance(state: np.ndarray, baseline: dict) -> dict:
    _, values = opt.initialize(state, opt.PARAMS)
    metrics = opt.metrics(values, opt.PARAMS)
    result = {
        "S2": float(metrics[0]),
        "v5": float(metrics[1]),
        "v4": float(metrics[2]),
        "v6": float(10 * r9_search.cw26(values)),
        "dailyMX": daily_mx(state),
    }
    ratios = [result[key] / baseline[key] for key in ("S2", "v5", "v4", "v6")]
    ratios.append(baseline["dailyMX"] / result["dailyMX"])
    result["meanRatio"] = float(np.mean(ratios))
    result["worstRatio"] = float(max(ratios))
    return result


def force_doubles(source: np.ndarray, tokens: tuple[str, ...]) -> np.ndarray:
    state = source.copy()
    for token in tokens:
        key = KEYS.index(token)
        final_index = 27 + opt.F.index(token.lower())
        old_key = int(state[final_index])
        if old_key != key:
            for index in range(27, 62):
                if state[index] == old_key:
                    state[index] = key
                elif state[index] == key:
                    state[index] = old_key
        state[opt.HEADS.index(token)] = key
    return state


def unique_common399(state: np.ndarray) -> int:
    return len({
        int(state[head]) * 26 + int(state[final])
        for head, final in zip(opt.PARAMS[-2], opt.PARAMS[-1])
    })


def state_d(state: np.ndarray) -> int:
    return int(sum(state[int(index)] != opt.PREF[int(index)] for index in ORDINARY))


def structural_audit(state: np.ndarray, tokens: tuple[str, ...]) -> dict:
    initial_keys = set(map(int, state[:27]))
    final_keys = set(map(int, state[27:62]))
    raw_memory = int(opt.memory(state))
    sound_codes = {
        (int(state[head]), int(state[final]))
        for head, final in zip(opt.PARAMS[-2], opt.PARAMS[-1])
    }
    aa_sound_codes = {code for code in sound_codes if code[1] in initial_keys}
    ab_sound_codes = {code for code in sound_codes if code[1] in TONE_KEYS}
    fixed_two_words = {
        (KEYS.index(code[0]), KEYS.index(code[1]))
        for code in TWO_WORD_CODES
    }
    return {
        "initialKeyCount": len(initial_keys),
        "finalKeyCount": len(final_keys),
        "auxiliaryOnsetOverlap": [KEYS[key] for key in TONE_KEYS if key in initial_keys],
        "uniqueCommon399": unique_common399(state),
        "rawM": raw_memory,
        "mnemonicAdjustedM": raw_memory - len(tokens),
        "D": state_d(state),
        "V": int(sum(state[27 + opt.F.index(final)] != KEYS.index(final.upper()) for final in "aeiou")),
        "aaSoundSlots": len(aa_sound_codes),
        "aaVacancies": len(initial_keys) ** 2 - len(aa_sound_codes),
        "abSoundSlots": len(ab_sound_codes),
        "currentTwoWordConflicts": len(fixed_two_words & sound_codes),
        "currentTwoWordStillVacant": len(fixed_two_words - sound_codes),
    }


def main() -> None:
    corpus = read_word_corpus(
        [REPO / f"snow_pinyin.{name}.dict.yaml" for name in ("base", "ext", "tencent")],
        allowed_pinyin=set(DATA["pinyin"]),
    )
    baseline = PAYLOAD["baseline"]["performance"]
    rows = []
    sources = {}
    subsets = [
        subset
        for size in range(1, 4)
        for subset in itertools.combinations(("A", "E", "O"), size)
    ]
    for scheme_id in ARGS.ids:
        source = BY_ID[scheme_id]
        source_state = np.array(source["state"], dtype=np.int32)
        sources[scheme_id] = {
            "structuralAudit": structural_audit(source_state, ()),
            "performance": source["performance"],
            "collision": source["collision"],
        }
        for subset in subsets:
            state = force_doubles(source_state, subset)
            identifier = f"{scheme_id}-MNEMONIC-{'-'.join(subset)}"
            entry = opt.toentry(state, DATA, identifier)
            rows.append({
                "id": identifier,
                "sourceId": scheme_id,
                "mnemonicDoubles": list(subset),
                "state": list(map(int, state)),
                "initialMap": entry["initialMap"],
                "finalMap": entry["finalMap"],
                "toneKeys": entry["tone"],
                "structuralAudit": structural_audit(state, subset),
                "performance": performance(state, baseline),
                "collision": evaluate_layout(entry, DATA["pinyin"], corpus),
            })
    output = {
        "method": "diagnostic direct AA/EE/OO zero-onset doubles; physical final-key swaps; no 21-key compensation",
        "warning": "Variants reuse IEUAO auxiliary keys as onset keys and expand the onset domain, so they are not legal 21x26 candidates.",
        "source": str(INPUT),
        "baseline": PAYLOAD["baseline"],
        "sources": sources,
        "rows": rows,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print("WROTE", OUTPUT, len(rows))


if __name__ == "__main__":
    main()
