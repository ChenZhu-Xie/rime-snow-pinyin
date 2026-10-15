#!/usr/bin/env python3
"""Quick verification of the new Palatal Triad initial families (M35..M39) and Joint Initial+Final moves."""
from __future__ import annotations

import itertools
import json
import os
import sys
import time
from pathlib import Path

for k in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[k] = "1"

import numpy as np

WORKTREE = Path(__file__).resolve().parents[2]
REPLAY_DIR = Path(os.environ.get("RIME_RESEARCH_REPLAY_DIR", Path(__file__).resolve().parents[2] / ".research-cache" / "R11_integrated_replay"))
sys.path.insert(0, str(REPLAY_DIR))
sys.path.insert(0, str(WORKTREE / "scripts" / "research"))

orig_cwd = os.getcwd()
os.chdir(REPLAY_DIR)
import opt
import r5_search as r5
import r9_search as r9
import search_engine as se
os.chdir(orig_cwd)

from harvest_all_21x26_pools import TONE_IEUAO, is_valid_21x26_pure_y, load_scorer

KEYS = opt.META["keys"]
KEY_IDX = {k: i for i, k in enumerate(KEYS)}


def make_init_from_spec(
    overrides: dict[str, str],
    aeo_key: str,
    w_key: str,
    y_key: str = "Y",
) -> np.ndarray:
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

    # Collect diverse V=0 and V=1 final maps from Round 1 frontier
    v0_finals = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 0]
    v1_finals = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 1]

    # Define candidate new initial maps across M35..M39
    test_inits = [
        # 1. M35/D2/V0: (x,f)->F, (q,W)->W, (j,AEO)->J, zh/ch/sh on {Q,V,X}
        ("M35-D2-XF-QW-JAEO-1", make_init_from_spec({"x": "F", "q": "W", "zh": "V", "ch": "X", "sh": "Q"}, "J", "W")),
        ("M35-D2-XF-QW-JAEO-2", make_init_from_spec({"x": "F", "q": "W", "zh": "X", "ch": "V", "sh": "Q"}, "J", "W")),
        # 2. M35/D2/V0: (j,f)->J, (q,W)->W, (x,AEO)->F, zh/ch/sh on {Q,V,X}
        ("M35-D2-JF-QW-XAEO-1", make_init_from_spec({"f": "J", "q": "W", "x": "F", "zh": "V", "ch": "X", "sh": "Q"}, "F", "W")),
        #Wait: f->J, q->W, x->F is D=3 (M=36)! What if (j,AEO)->J, (q,f)->F, (x,W)->W?
        # In (j,AEO)->J, (q,f)->F, (x,W)->W: only q->F and x->W move! That is D=2, M=35!
        ("M35-D2-QF-XW-JAEO-1", make_init_from_spec({"q": "F", "x": "W", "zh": "V", "ch": "X", "sh": "Q"}, "J", "W")),
        ("M35-D2-QF-XW-JAEO-2", make_init_from_spec({"q": "F", "x": "W", "zh": "X", "ch": "V", "sh": "Q"}, "J", "W")),
        # 3. M36/D3/V0: f->J, d->F, q->W, sh->D, zh->V, ch->Q, AEO->X, W->W (No-DE + (j,f)->J + W->W!)
        ("M36-D3-JF-DF-QW-1", make_init_from_spec({"f": "J", "d": "F", "q": "W", "zh": "V", "ch": "Q", "sh": "D"}, "X", "W")),
        # 4. M36/D3/V0: q->F, d->H? No, q->W, x->F, d->V, sh->D, zh->X, ch->Q, AEO->J, W->W
        ("M36-D3-XF-QW-DV-1", make_init_from_spec({"x": "F", "q": "W", "d": "V", "zh": "X", "ch": "Q", "sh": "D"}, "J", "W")),
        # 5. M37/D4/V0: f->K, k->X, x->K, q->W, zh->F, ch->V, sh->Q, AEO->J, W->W
        ("M37-D4-XFK-QW-1", make_init_from_spec({"f": "K", "k": "X", "x": "K", "q": "W", "zh": "F", "ch": "V", "sh": "Q"}, "J", "W")),
        # 6. M37/D4/V0: q->F, x->W, d->H, h->V, zh->X, ch->Q, sh->D, AEO->J, W->W (No-DE + (q,f)->F + (x,W)->W!)
        ("M37-D4-QF-XW-DH-1", make_init_from_spec({"q": "F", "x": "W", "d": "H", "h": "V", "zh": "X", "ch": "Q", "sh": "D"}, "J", "W")),
        # 7. M38/D5/V0: f->J, q->W, x->K, k->X, d->F, zh->V, ch->Q, sh->D, AEO->K, W->W
        ("M38-D5-JF-QW-XAEO_K-DF", make_init_from_spec({"f": "J", "q": "W", "x": "K", "k": "X", "d": "F", "zh": "V", "ch": "Q", "sh": "D"}, "K", "W")),
        # 8. M38/D5/V0: q->F, x->K, k->X, d->H, h->V, zh->W, ch->Q, sh->D, AEO->J, W->W? No, W must pair with j,q,x!
        # Pair W with j,q,x: q->F (with f), x->W (with W), j->K (with AEO), k->X, d->J!
        ("M38-D5-QF-XW-JAEO_K-DJ", make_init_from_spec({"q": "F", "x": "W", "j": "K", "k": "X", "d": "J", "zh": "V", "ch": "Q", "sh": "D"}, "K", "W")),
    ]

    for tag, init_st in test_inits:
        best_v3 = 99.0
        best_desc = None
        for fin_st in v0_finals:
            st = np.zeros(67, dtype=np.int32)
            st[:27] = init_st
            st[27:62] = fin_st
            st[62:] = TONE_IEUAO
            ok = is_valid_21x26_pure_y(st)
            if not ok:
                print(f"  INVALID {tag}")
                break
            v3 = float(engine.score_all(st)[0])
            if v3 < best_v3:
                best_v3 = v3
                _, out = opt.initialize(st, opt.PARAMS)
                m4 = opt.metrics(out, opt.PARAMS)
                desc = r5.describe(st)
                best_desc = (desc["M"], desc["D"], desc["V"], float(m4[0]), float(m4[1]), float(desc["homeS2"]), float(desc["rpMax"]))
        if best_desc:
            M, D, V, s2, e6, home, pmax = best_desc
            print(f"  {tag:26s} -> M{M}/D{D}/V{V} | best_v3={best_v3:.5f} | S2={s2:.2f} E6={e6:.4f} | Home={home*100:.2f}% Pmax={pmax*100:.2f}%")


if __name__ == "__main__":
    main()
