#!/usr/bin/env python3
"""Inspect initial frequencies and test all permutations of retroflexes & low-freq consonant evacuations on the new (q,W)->W and (x,W)->W chassis."""
from __future__ import annotations

import itertools
import json
import os
import sys
from pathlib import Path

for k in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[k] = "1"

import numpy as np

WORKTREE = Path(__file__).resolve().parents[2]
REPLAY_DIR = Path(os.environ.get("TEMP", "/tmp")) / "rime-21x21-search" / "R11_integrated_replay"
sys.path.insert(0, str(REPLAY_DIR))
sys.path.insert(0, str(WORKTREE / "scripts" / "research"))

orig_cwd = os.getcwd()
os.chdir(REPLAY_DIR)
import opt
import r5_search as r5
import search_engine as se
os.chdir(orig_cwd)

from harvest_all_21x26_pools import TONE_IEUAO, load_scorer
from stage2b_basin_descent import (
    KEY_IDX,
    VIX,
    V_FINAL_IDX,
    V_KEY_IDX,
    _sa_optimize_finals,
    build_final_compat_matrix,
)

KEYS = opt.META["keys"]


def make_init(overrides: dict[str, str], aeo_key: str, w_key: str, y_key: str = "Y") -> np.ndarray:
    st = np.zeros(27, dtype=np.int32)
    for i, h in enumerate(opt.HEADS[:21]):
        if len(h) == 1:
            st[i] = KEY_IDX[h.upper()]
    for h, k in overrides.items():
        st[opt.HEADS.index(h)] = KEY_IDX[k]
    st[21] = st[22] = st[23] = KEY_IDX[aeo_key]
    st[24] = KEY_IDX[w_key]
    st[25] = st[26] = KEY_IDX[y_key]
    return st


def main():
    engine = load_scorer()
    data_dir = WORKTREE / "research-notes" / "data"
    r1_frontier = json.loads((data_dir / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))["frontier"]

    v0_vlocked = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 0 and r["state"][V_FINAL_IDX] == V_KEY_IDX]
    v0_all = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 0]
    v1_vlocked = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 1 and r["state"][V_FINAL_IDX] == V_KEY_IDX]
    v1_all = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 1]

    # Print token loads on track 0 (S2)
    loads0 = r5.LOADS[0, :27]
    print("=== Initial Token Loads (Track 0) ===")
    for i, h in enumerate(opt.HEADS):
        print(f"  {i:2d} {h:4s}: {loads0[i]*100:5.2f}%")

    # Test comprehensive D=1..7 initial layouts paired with best finals from v0_vlocked / v0_all / v1_vlocked / v1_all
    test_specs = []

    # 1. D=2, M=35/36: all 6 permutations of zh,ch,sh on {V, Q, X} for both (x,f)->F+(q,W)->W and (q,f)->F+(x,W)->W
    for z_k, c_k, s_k in itertools.permutations(["V", "Q", "X"]):
        test_specs.append((f"D2-XF-QW-z{z_k}c{c_k}s{s_k}", make_init({"x": "F", "q": "W", "zh": z_k, "ch": c_k, "sh": s_k}, "J", "W")))
        test_specs.append((f"D2-QF-XW-z{z_k}c{c_k}s{s_k}", make_init({"q": "F", "x": "W", "zh": z_k, "ch": c_k, "sh": s_k}, "J", "W")))

    # 2. D=3, M=36/37: (x,f)->F, (q,W)->W, (j,AEO)->J + 1 displaced consonant c1 -> {X, Q, V} and retroflex on C1
    for c1 in ["c", "z", "k", "p", "r", "d", "t", "g", "h", "b", "m", "n", "l", "s"]:
        C1 = c1.upper()
        # Put sh on C1, zh on V, ch on Q, c1 on X
        test_specs.append((f"D3-XF-QW-{c1}X-sh{C1}", make_init({"x": "F", "q": "W", c1: "X", "zh": "V", "ch": "Q", "sh": C1}, "J", "W")))
        test_specs.append((f"D3-XF-QW-{c1}X-zh{C1}", make_init({"x": "F", "q": "W", c1: "X", "zh": C1, "ch": "Q", "sh": "V"}, "J", "W")))
        test_specs.append((f"D3-QF-XW-{c1}X-sh{C1}", make_init({"q": "F", "x": "W", c1: "X", "zh": "V", "ch": "Q", "sh": C1}, "J", "W")))

    # 3. D=4, M=37/38:
    # 3a. (x,f)->K or (q,f)->K, k->X, (q/x,W)->W, (j,AEO)->J, retroflexes on {F, V, Q}
    for z_k, c_k, s_k in itertools.permutations(["F", "V", "Q"]):
        test_specs.append((f"D4-XFK-QW-z{z_k}c{c_k}s{s_k}", make_init({"x": "K", "f": "K", "k": "X", "q": "W", "zh": z_k, "ch": c_k, "sh": s_k}, "J", "W")))
        test_specs.append((f"D4-QFK-XW-z{z_k}c{c_k}s{s_k}", make_init({"q": "K", "f": "K", "k": "X", "x": "W", "zh": z_k, "ch": c_k, "sh": s_k}, "J", "W")))
    # 3b. (x,f)->F, (q,W)->W, (j,AEO)->J + 2 displaced consonants -> {X, Q} and retroflexes on {C1, C2, V}
    for c1, c2 in [("d", "c"), ("d", "k"), ("d", "z"), ("d", "p"), ("k", "c"), ("k", "p"), ("c", "p"), ("d", "h"), ("h", "c")]:
        C1, C2 = c1.upper(), c2.upper()
        test_specs.append((f"D4-XF-QW-{c1}X-{c2}Q-sh{C1}zh{C2}", make_init({"x": "F", "q": "W", c1: "X", c2: "Q", "sh": C1, "zh": C2, "ch": "V"}, "J", "W")))
    # 3c. d->F, f->J, q->W, c/k/p->X, sh->D, zh->C1, ch->V, AEO->Q
    for c1 in ["c", "k", "p", "z", "h"]:
        C1 = c1.upper()
        test_specs.append((f"D4-JF-QW-dF-{c1}X-shD-zh{C1}", make_init({"f": "J", "q": "W", "d": "F", c1: "X", "sh": "D", "zh": C1, "ch": "V"}, "Q", "W")))

    # 4. D=5, M=38/39:
    # 4a. (x,f)->K, k->X, (q,W)->W, (j,AEO)->J + 1 more displaced consonant (c1 -> Q or V, retroflexes on {F, C1, V/Q})
    for c1 in ["c", "z", "p", "r", "d", "h", "g", "t", "b"]:
        C1 = c1.upper()
        test_specs.append((f"D5-XFK-QW-{c1}Q-shF-zh{C1}", make_init({"x": "K", "f": "K", "k": "X", "q": "W", c1: "Q", "sh": "F", "zh": C1, "ch": "V"}, "J", "W")))
        test_specs.append((f"D5-XFK-QW-{c1}Q-zhF-sh{C1}", make_init({"x": "K", "f": "K", "k": "X", "q": "W", c1: "Q", "zh": "F", "sh": C1, "ch": "V"}, "J", "W")))
    # 4b. (x,f)->K, k->X, (q,W)->W, (j,AEO)->J, d->F, sh->D, zh->V, ch->Q (Wait: d->F, sh->D, zh->V, ch->Q with (x,f)->K, k->X, q->W is D=5!)
    test_specs.append(("D5-XFK-QW-dF-shD-zhV-chQ", make_init({"x": "K", "f": "K", "k": "X", "q": "W", "d": "F", "sh": "D", "zh": "V", "ch": "Q"}, "J", "W")))
    test_specs.append(("D5-XFK-QW-dF-zhD-shV-chQ", make_init({"x": "K", "f": "K", "k": "X", "q": "W", "d": "F", "zh": "D", "sh": "V", "ch": "Q"}, "J", "W")))

    # 5. D=6, M=39/40:
    # (x,f)->K, k->X, (q,W)->W, (j,AEO)->J, d->F, c1->Q, sh->D, zh->C1, ch->V
    for c1 in ["c", "z", "p", "h", "g", "r"]:
        C1 = c1.upper()
        test_specs.append((f"D6-XFK-QW-dF-{c1}Q-shD-zh{C1}", make_init({"x": "K", "f": "K", "k": "X", "q": "W", "d": "F", c1: "Q", "sh": "D", "zh": C1, "ch": "V"}, "J", "W")))

    print(f"\nScreening {len(test_specs)} new initial layouts across v0_vlocked and v1_vlocked final pools...")
    results = []
    for tag, init_st in test_specs:
        # Evaluate with v0_vlocked (M = 33 + D)
        best_v0 = 99.0
        best_st0 = None
        for fin_st in v0_vlocked:
            st = np.zeros(67, dtype=np.int32)
            st[:27] = init_st
            st[27:62] = fin_st
            st[62:] = TONE_IEUAO
            v3 = float(engine.score_all(st)[0])
            if v3 < best_v0:
                best_v0 = v3
                best_st0 = st.copy()
        # Evaluate with v1_vlocked (M = 34 + D)
        best_v1 = 99.0
        best_st1 = None
        for fin_st in v1_vlocked:
            st = np.zeros(67, dtype=np.int32)
            st[:27] = init_st
            st[27:62] = fin_st
            st[62:] = TONE_IEUAO
            v3 = float(engine.score_all(st)[0])
            if v3 < best_v1:
                best_v1 = v3
                best_st1 = st.copy()
        desc0 = r5.describe(best_st0)
        desc1 = r5.describe(best_st1)
        results.append((desc0["D"], desc0["M"], best_v0, best_v1, tag, desc0["homeS2"], desc0["rpMax"]))

    for d_val in sorted(set(r[0] for r in results)):
        sub = [r for r in results if r[0] == d_val]
        sub.sort(key=lambda x: x[2])
        print(f"\n=== Top Initials for D={d_val} (V0 M={33+d_val}, V1 M={34+d_val}) ===")
        for d, m, v0, v1, tag, home, pmax in sub[:8]:
            print(f"  {tag:32s} | M{m}/D{d}/V0={v0:.5f} | M{m+1}/D{d}/V1={v1:.5f} | Home={home*100:.2f}% Pmax={pmax*100:.2f}%")


if __name__ == "__main__":
    main()
