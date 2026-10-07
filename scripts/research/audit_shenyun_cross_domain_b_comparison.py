#!/usr/bin/env python3
"""Summarize which R11 layouts the current fixed-B completion scores cover."""

from __future__ import annotations

import argparse
import base64
from collections import Counter, defaultdict
import gzip
import json
from pathlib import Path

from integrate_shenyun_21x21_b_paths import DEFAULT_HTML


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML)
    args = parser.parse_args()
    text = args.html.read_text(encoding="utf-8")
    start = text.index(">", text.index('<script id="payload"')) + 1
    end = text.index("</script>", start)
    data = json.loads(gzip.decompress(base64.b64decode(text[start:end])))
    scores = data["completionB"]["schemes"]
    grouped = defaultdict(list)
    for entry in data["entries"]:
        ident = entry["id"]
        domain = "×".join(map(str, entry["capacity"]))
        aux = entry.get("auxiliaryClass") or entry.get("reservedKeys") or entry.get("tone") or "none"
        grouped[(domain, aux)].append((entry, scores[ident]))
    for (domain, aux), items in sorted(grouped.items(), key=lambda x: (-len(x[1]), x[0])):
        native = sum(e.get("tone") == "IVUAO" for e, _ in items)
        coverage = min(v["modes"][mode][kind]["coverage"] for _, v in items
                       for mode in ("keytao", "sanpin") for kind in ("character", "word"))
        extrapolated = max(v["modes"][mode][kind]["extrapolatedCodeShare"] for _, v in items
                           for mode in ("keytao", "sanpin") for kind in ("character", "word"))
        print(json.dumps({"domain": domain, "aux": aux, "schemes": len(items),
                          "toneIVUAO": native, "minimumCoverage": round(coverage, 6),
                          "maxExtrapolatedShare": round(extrapolated, 6)}, ensure_ascii=False))
    print(json.dumps({"total": len(data["entries"]),
                      "toneOrders": Counter(e.get("tone") for e in data["entries"]),
                      "withEightBTable": sum("bPathMetrics" in e for e in data["entries"]),
                      "withNativeEightB": sum("bPathMetricsNative" in e for e in data["entries"]),
                      "auxReservationMismatch": [e["id"] for e in data["entries"] if e.get("auxiliaryMappingMatchesReservation") is False],
                      "topgongInvalid": [e["id"] for e in data["entries"] if e.get("topgongValid") is False],
                      "nativeBPolicy": data["completionB"]["policy"],
                      "fixedBPolicy": data["completionBFixed"]["policy"]}, ensure_ascii=False, default=dict))


if __name__ == "__main__":
    main()
