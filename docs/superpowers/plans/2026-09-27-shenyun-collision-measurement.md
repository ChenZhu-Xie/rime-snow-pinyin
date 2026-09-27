# Shenyun Collision Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure common two-character, four-character, and cross-length code collisions for Shenyun and the original Ice/Snow Jiandao layout on identical weighted word sets.

**Architecture:** A branching Rime-algebra evaluator converts each pronunciation to canonical and accepted code sets. A dictionary loader builds shared weighted cohorts, a pure metric module computes collision buckets at several cutoffs, and a CLI writes ignored detailed JSON plus a tracked Markdown comparison.

**Tech Stack:** TypeScript, Node.js built-ins, `tsx`, `node:test`, `js-yaml`, existing Snow Pinyin dictionaries.

**Spec:** `docs/superpowers/specs/2026-09-27-fixed-candidate-corpus-design.md`

## Global Constraints

- Both layouts must use identical words, pronunciations, weights, and cutoff rules.
- Report canonical and accepted-spelling results separately for the original layout.
- Treat `derive` as a retained branch, never as replacement of the source branch.
- Report metrics and concrete buckets, not a single opaque score.
- Write detailed JSON under ignored `cache/fixed-corpus/reports/`; track only a compact Markdown report and stable mapping snapshot.

## Review Focus

- Polyphonic entries must not be silently collapsed into the wrong pronunciation or double-counted as separate words in word-rate metrics.
- Duplicate dictionary rows across base/ext/tencent must have a documented deterministic weight merge.
- Tone keys must be removed only where the compared four-key path requires toneless double-pinyin, not before syllable mapping.
- A word accepting several derived codes must count once in affected-word totals but appear in every actual collision bucket.
- Cutoffs larger than the available encodable cohort must be labelled with the actual cohort size instead of repeating misleading denominators.

---

### Task 1: Branching Rime algebra and original-layout snapshot

**Files:**
- Create: `config/original-jiandao-algebra.yaml`
- Create: `scripts/fixed-corpus/algebra.ts`
- Create: `scripts/fixed-corpus/test/algebra.test.ts`

**Interfaces:**
- Produces: `AlgebraRule`, `AlgebraResult`, `parseAlgebraRules(yaml, section)`, and `applyAlgebra(input, rules): AlgebraResult` where result contains `canonical: string | null` and `accepted: string[]`.

- [ ] **Step 1: Write failing algebra tests**

Test ordered `xform`, transliteration `xlit`, removal `erase`, and branching `derive`. Assert that `derive/uang/M/` preserves both the unmodified and derived branch for subsequent rules while canonical follows the non-derived main path.

- [ ] **Step 2: Run algebra tests and verify red**

Run: `npm run test:corpus -- --test-name-pattern="algebra|derive|canonical"`

Expected: FAIL because `algebra.ts` is absent.

- [ ] **Step 3: Add the stable original-layout snapshot**

Copy only `sanpin_algebra` from `b8fd127^:snow_sanpin.schema.yaml` into a tracked YAML fixture with provenance comments naming that commit boundary. Do not make runtime behavior depend on Git history.

- [ ] **Step 4: Implement the branching evaluator**

Support the exact Rime rule operators used by the current Shenyun section and original snapshot: `erase`, `xform`, `derive`, and `xlit`. Apply each rule to every active branch, deduplicate in insertion order, and keep the main non-derived branch as canonical.

- [ ] **Step 5: Run algebra tests and type checking**

Run: `npm run test:corpus`

Expected: all tests PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- config/original-jiandao-algebra.yaml scripts/fixed-corpus/algebra.ts scripts/fixed-corpus/test/algebra.test.ts
git commit -m "feat: 保留原键道派生编码语义"
```

### Task 2: Shared weighted cohorts and layout code generation

**Files:**
- Create: `scripts/fixed-corpus/cohort.ts`
- Create: `scripts/fixed-corpus/layout.ts`
- Create: `scripts/fixed-corpus/test/cohort.test.ts`
- Create: `scripts/fixed-corpus/test/layout.test.ts`

**Interfaces:**
- Consumes: `applyAlgebra` from Task 1.
- Produces: `DictionaryWord`, `WordReading`, `loadWeightedCohort(paths, lengths)`, `encodeSyllable(syllable, layout, mode)`, and `encodeWord(reading, layout, mode)`.

- [ ] **Step 1: Write failing cohort tests**

Use fixture base/ext/tencent files containing duplicates and polyphones. Assert only two- and four-character Chinese words enter the cohort, identical word+reading rows keep the maximum weight, different readings remain available, and word ranking uses the maximum reading weight with stable lexical tie-breaking.

- [ ] **Step 2: Run cohort tests and verify red**

Run: `npm run test:corpus -- --test-name-pattern="cohort|weight|polyphonic"`

Expected: FAIL because cohort loader is absent.

- [ ] **Step 3: Implement cohort loading**

Load `snow_pinyin.base.dict.yaml`, `snow_pinyin.ext.dict.yaml`, and `snow_pinyin.tencent.dict.yaml`; exclude `snow_pinyin.user.dict.yaml`. Validate syllable count equals word code-point length and emit diagnostics for invalid rows.

- [ ] **Step 4: Write failing layout-code tests**

Assert exact two-character full-code and four-character initial-code output for representative zero-initial, `zh/ch/sh`, `ju/jue`, and derived-original cases under Shenyun and the original layout. Assert canonical returns one code while accepted returns a stable set.

- [ ] **Step 5: Implement layout code generation**

Use full two-key syllable codes for two-character words and the first key of each syllable for four-character words, producing comparable four-key word codes. Strip tone keys after the layout maps the complete toned syllable.

- [ ] **Step 6: Run all tests and type checking**

Run: `npm run test:corpus`

Expected: all tests PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- scripts/fixed-corpus/cohort.ts scripts/fixed-corpus/layout.ts scripts/fixed-corpus/test/cohort.test.ts scripts/fixed-corpus/test/layout.test.ts
git commit -m "feat: 构建双拼碰撞共同词集"
```

### Task 3: Collision metrics

**Files:**
- Create: `scripts/fixed-corpus/collisions.ts`
- Create: `scripts/fixed-corpus/test/collisions.test.ts`

**Interfaces:**
- Consumes: weighted cohorts and encoded words from Task 2.
- Produces: `measureCollisions(words2, words4, options): CollisionMeasurement`, including `withinTwo`, `withinFour`, `crossLength`, coverage, weighted mass, largest buckets, and affected word identities.

- [ ] **Step 1: Write failing metric tests with a hand-computable cohort**

Create unique, 2↔2, 4↔4, and 2↔4 buckets. Assert exact bucket count, affected distinct-word count, unique-code rate, maximum bucket size, unweighted rate, weighted mass rate, and that a multi-code word is counted once in word totals.

- [ ] **Step 2: Run metric tests and verify red**

Run: `npm run test:corpus -- --test-name-pattern="collision|bucket|weighted"`

Expected: FAIL because the metric module is absent.

- [ ] **Step 3: Implement pure collision measurement**

Index codes to distinct word identities. Use summed word weights for weighted mass, with the denominator equal to total encodable distinct-word weight in that cohort. Keep full bucket members for JSON and deterministic top examples for Markdown.

- [ ] **Step 4: Run metric tests**

Run: `npm run test:corpus`

Expected: all tests PASS with exact fixture metrics.

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- scripts/fixed-corpus/collisions.ts scripts/fixed-corpus/test/collisions.test.ts
git commit -m "feat: 计算双拼词组碰撞指标"
```

### Task 4: Measurement CLI and multi-cutoff report

**Files:**
- Create: `scripts/fixed-corpus/measure-cli.ts`
- Create: `scripts/fixed-corpus/report.ts`
- Create: `scripts/fixed-corpus/test/report.test.ts`
- Create: `reports/shenyun-collision-comparison.md`
- Modify: `scripts/package.json`

**Interfaces:**
- Consumes: Task 1-3 modules.
- Produces: `npm run corpus:measure`, `renderCollisionMarkdown(report)`, and JSON report at `cache/fixed-corpus/reports/collisions.json`.

- [ ] **Step 1: Write failing report tests**

Assert output sections for Top 500/1,000/2,000/5,000/10,000/all, actual cohort sizes, Shenyun canonical, original canonical, original accepted, all three collision classes, weighted/unweighted deltas, and top concrete buckets.

- [ ] **Step 2: Run report tests and verify red**

Run: `npm run test:corpus -- --test-name-pattern="report|cutoff|delta"`

Expected: FAIL because CLI/report modules are absent.

- [ ] **Step 3: Implement CLI and deterministic report rendering**

Add `corpus:measure` and update `corpus:all` to run collect then measure. Detailed JSON contains all buckets; tracked Markdown contains methodology, cohort coverage, metric tables, deltas, and a bounded list of severe examples.

- [ ] **Step 4: Run local tests and type checking**

Run: `npm run test:corpus`

Expected: all tests PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 5: Generate the real comparison**

Run: `npm run corpus:measure`

Expected: detailed JSON and `reports/shenyun-collision-comparison.md` are generated for both layouts and every applicable cutoff.

- [ ] **Step 6: Audit fairness and examples**

Confirm each compared row uses identical cohort counts. Manually recompute at least three severe buckets from the source pronunciations/codes. Confirm accepted-original metrics are not accidentally identical to canonical when original `derive` rules apply.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- scripts/package.json scripts/fixed-corpus/measure-cli.ts scripts/fixed-corpus/report.ts scripts/fixed-corpus/test/report.test.ts reports/shenyun-collision-comparison.md
git commit -m "feat: 对比神韵与原键道词组碰撞"
```

