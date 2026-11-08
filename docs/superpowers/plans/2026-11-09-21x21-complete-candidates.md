# 21×21 Complete Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove partial single-character candidates from the four 21×21 schemes' non-buffered popping four-code buckets without weakening dynamic user ranking or buffered word creation.

**Architecture:** Centralize exact input-consumption checks in `candidate_priority.lua`, use them to limit learned ranking and memorization, then apply existing `table_like.translate` complete-candidate support to the keydao main route and a two-character acceptance rule to the sanpin two-word proxy route. Keep sentence and buffered streams permissive and leave 21×21 page ordering quota-free.

**Tech Stack:** Lua 5.4, Rime Lua components, Mira YAML scenarios, Bun static corpus checks.

**Spec:** `docs/superpowers/specs/2026-11-09-21x21-complete-candidates-design.md`

## Global Constraints

- Do not run Mira, `bun scripts/test.ts`, native Rime consoles, WSL Rime, or Docker Rime locally.
- Run local Lua unit, formatting, static, generation, and corpus checks before pushing; run Mira only through GitHub Actions after push.
- Preserve the four 21×21 schemes' native two-character/four-character relative ranking and dynamic learning; do not add `length_balance` to them.
- Preserve partial candidates in sentence and buffered modes.
- Use `apply_patch` for repository edits and do not revert unrelated work.

## Review Focus

- A four-code keydao input with a valid two-character phrase must not expose a one-character prefix candidate in non-buffered popping mode.
- A four-code sanpin input with a valid two-character phrase must not expose a one-character prefix candidate in non-buffered popping mode.
- A learned partial candidate must not move ahead of complete candidates for the current input.
- Buffered sanpin word creation must retain its intentional partial-selection path.
- Sentence mode must retain native prefix candidates for continuous composition.

---

### Task 1: Exact learned-candidate scope

**Files:**
- Modify: `lua/snow/candidate_priority.lua`
- Modify: `lua/snow/learned_priority.lua`
- Test: `spec/candidate_priority.test.lua`
- Test: `spec/learned_priority.test.lua`

**Interfaces:**
- Produces: `candidate_priority.consumes_input(candidate, expected_length) -> boolean` for all exact-consumption decisions.
- Produces: `learned_priority.prioritize(candidates, memory, cache, expected_length) -> Candidate[]`, where only exact candidates are learned-ranked.
- Consumes: Candidate `_start`/`_end` offsets after proxy-to-real-input preparation.

- [ ] **Step 1: Write failing unit tests**

Add literal fixtures proving `consumes_input` accepts a four-code candidate consuming four positions and rejects one consuming two; extend learned-priority fixtures so a high-weight partial user candidate remains in ordinary relative order behind a complete learned phrase.

- [ ] **Step 2: Run tests to verify RED**

Run: `lua spec/candidate_priority.test.lua; lua spec/learned_priority.test.lua`

Expected: failure because `consumes_input` and the exact-length ranking contract do not exist.

- [ ] **Step 3: Implement exact learned scope**

Add `consumes_input`; pass current input length into `prioritize`; only classify exact candidates as learned. In the commit notifier, write a wrapped phrase only when the selected candidate consumes the complete current input.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `lua spec/candidate_priority.test.lua; lua spec/learned_priority.test.lua`

Expected: both scripts print `ok` and exit 0.

- [ ] **Step 5: Commit**

Commit message: `fix: scope learned ranking to complete candidates`

### Task 2: Complete-only 21×21 popping routes

**Files:**
- Modify: `lua/snow/table_like.lua`
- Modify: `spec/snow_jiandao.test.yaml`
- Modify: `spec/snow_jiandao_classic.test.yaml`
- Modify: `spec/snow_sanpin.test.yaml`
- Modify: `spec/snow_sanpin_classic.test.yaml`

**Interfaces:**
- Consumes: `candidate_priority.consumes_input(candidate, expected_length) -> boolean` from Task 1.
- Produces: keydao main and sanpin two-word routes that accept partial candidates only outside non-buffered popping mode.

- [ ] **Step 1: Add failing candidate-scope scenarios**

Add a `no_single()` helper and four-code assertions for all four 21×21 schemes. Change the existing non-buffered sanpin partial-word-creation scenario to the new no-single contract; keep the buffered scenario.

- [ ] **Step 2: Record RED without running local Mira**

Run the Lua unit-level route predicate test added alongside `table_like.lua` changes before production edits; it must fail against the current permissive predicate. Do not run Mira locally. The four YAML scenarios are expected to fail on the current deployed behavior and will be executed by GitHub Actions after push.

- [ ] **Step 3: Implement route completeness**

Make keydao `main` request complete candidates only when `popping` is on and `buffered` is off. Make sanpin `t12` accept a one-character partial from its two-word proxy only while buffered; otherwise accept exactly two characters. Reuse `consumes_input` for proxy completeness after mapping to real input.

- [ ] **Step 4: Run local verification**

Run the focused Lua tests, `bun run --cwd scripts check:format`, `bun scripts/check-pinyin-dict.ts`, and the relevant fixed-corpus checks. Do not run Mira locally.

Expected: all local commands exit 0.

- [ ] **Step 5: Commit**

Commit message: `fix: exclude partial singles from 21x21 buckets`

### Task 3: Push and remote candidate verification

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: Task 1 and Task 2 commits.
- Produces: GitHub Actions evidence for all four 21×21 Mira scenarios.

- [ ] **Step 1: Verify repository state and local commit range**

Run the final local verification commands and inspect `git diff`/`git status`.

- [ ] **Step 2: Select the configured Git identity and push**

Run `git swap auto`, push the current branch to its configured GitHub remote, and verify local and remote commit IDs match.

- [ ] **Step 3: Inspect GitHub Actions**

Wait for the pushed workflow runs and report the exact Mira results. If a scenario fails, diagnose from the remote logs and return to a RED→GREEN fix cycle.

- [ ] **Step 4: Commit any verified corrective changes**

Only if remote verification exposes a real defect; otherwise no additional commit.
