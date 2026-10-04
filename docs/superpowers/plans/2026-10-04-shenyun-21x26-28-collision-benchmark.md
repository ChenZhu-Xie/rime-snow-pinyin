# Shenyun 21x26/21x28 Collision Benchmark Integration Plan

**Goal:** Add the historical 21x28 performance and collision extremes to the
R11 atlas, calculate one reproducible AUAU/AAAU/AAAA collision contract for
every declared 21x28 scheme and the three comparable R11 21x26 extremes, and
expose both summary and full-cut metrics in the offline HTML.

**Spec:** The user-approved design in the 2026-10-04 session, narrowed on
2026-10-05 to all 21x28 schemes plus `R11-21X26-M36-01`,
`R11-21X26-M37-02`, and `R11-21X26-M38-03`. All use one Y onset class (YU
spellings share the Y key). Five sortable summary columns appear in the main
benchmark, with a dedicated table for Top 500/1k/2k/5k/10k affected rate,
first-choice loss, cross buckets, all collision buckets, and maximum bucket;
no README or release changes.

The collision engine treats `pure-y` (ØY includes the YU spellings) and
`split-y-yu` (ØY and ØYU use different onset keys) as explicit, independently
selectable scopes. The current 21x28 comparison activates `pure-y`; later
comparisons may activate either scope without inferring it from capacity.

**Global constraints:**

- Preserve the existing 474-entry curated catalogue and all frozen scores.
- Add five missing R10-derived 21x28 extremes and five missing members of the
  historical six-layout collision extreme. Reuse the existing
  `SNOW-SHENYUN-21X28-TONE` as the sixth layout rather than duplicating it.
- Use the Snow base/ext/tencent dictionaries and the exact standard four-code
  families `AUAU`, `AAAU`, and `AAAA`.
- Treat missing collision results as missing, never zero.
- Do not modify README files, release material, or released Rime schemas.
- Do not commit or push unless the user asks in a later turn.

## Task 1: Freeze historical collision-extreme sources

**Files:**

- Create: `research-notes/data/shenyun-21x28-collision-extremes.json`
- Test: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/tools/test_shenyun_collision_benchmark.py`

**Steps:**

1. Add failing tests for the six stable IDs, exact punctuation-final direction,
   399/399 uniqueness, D1/V0, and reuse of the existing balanced tone layout.
2. Copy the six audited mappings from the retained formal-search artifact into
   a repository-owned JSON source with provenance and hashes.
3. Run the focused tests and confirm they pass.

## Task 2: Implement the catalogue-wide collision engine

**Files:**

- Create: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/tools/shenyun_collision_benchmark.py`
- Modify: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/tools/test_shenyun_collision_benchmark.py`

**Steps:**

1. Add failing tests for the 20-scheme comparison cohort, all five cuts,
   missing-code coverage, deterministic winners, and known frontier metrics.
2. Implement a codeList-based engine that parses and sorts the corpus once,
   encodes only the Top 10,000 of each word length, and evaluates every layout.
3. Cross-check at least one R10-derived and one historical collision-extreme
   layout against the previously frozen results.

## Task 3: Integrate ten missing historical schemes and collision payloads

**Files:**

- Modify: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/tools/integrate_shenyun_21x28.py`
- Modify: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/tools/test_shenyun_collision_benchmark.py`
- Generate: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/a7_CKT_R11.html`
- Generate: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/a7_CKT_R11_integrated_materials/shenyun_21x26_28_collisions.json`

**Steps:**

1. Add failing integration assertions for a 484-entry catalogue, ten new IDs,
   and complete collision coverage for all 17 declared 21x28 entries plus the
   three comparable 21x26 extremes.
2. Generalize the integrator to consume both tracked frontier sources, score
   only missing entries with the frozen R11 engine, preserve existing entries,
   and attach collision results plus corpus/method provenance.
3. Generate the HTML and audit JSON, then verify frozen pre-existing scores did
   not change.

## Task 4: Expose summary and complete collision views

**Files:**

- Modify: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/tools/integrate_shenyun_21x28.py`
- Modify: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/tools/test_shenyun_collision_benchmark.py`
- Generate: `D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/a7_CKT_R11.html`

**Steps:**

1. Add failing static/browser assertions for five sortable benchmark summary
   columns, a dedicated collision view, five cut rows per eligible scheme, and
   blank/not-applicable behavior outside the cohort.
2. Inject the collision view and navigation while retaining the existing UX
   benchmark renderer and CSV/export behavior.
3. Run Python tests, payload audits, existing static tests, and browser smoke
   tests. Record any pre-existing count assertion separately from regressions.

## Review focus

- Physical-key relabelling must not be used as an invalid collision-cache key:
  cross-family equality includes A/U role overlap.
- Polyphonic words must count once per word under the same winner and
  first-choice rules as the frozen research reports.
- All five cuts must use the same globally frozen frequency order.
- Existing entries and score objects must remain byte-equivalent at the JSON
  value level, except for the newly attached collision fields.
- The main table must not coerce absent collision metrics to zero.
