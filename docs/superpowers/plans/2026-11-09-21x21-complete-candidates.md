# 21×21 Prefix Candidate Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve upstream 21×21 candidate streams while preventing the fork's learned-priority layer from promoting or memorizing partial-prefix candidates as exact input matches.

**Architecture:** Centralize exact input-consumption checks in `candidate_priority.lua`; use the check only in `learned_priority.lua` and the existing exact user-phrase quality bonus. Leave `table_like.lua` candidate acceptance and all four scheme scenarios aligned with upstream.

**Tech Stack:** Lua 5.4, Rime Lua components, Bun static corpus checks.

**Spec:** `docs/superpowers/specs/2026-11-09-21x21-complete-candidates-design.md`

## Global Constraints

- Do not run Mira, `bun scripts/test.ts`, native Rime consoles, WSL Rime, or Docker Rime locally.
- Preserve upstream prefix candidates in the four 21×21 schemes; do not add candidate-length restrictions or `length_balance` to them.
- Keep 21×26 length balancing unchanged.
- Use `apply_patch` for repository edits and do not revert unrelated work.

## Review Focus

- A high-weight partial user candidate must not be promoted as an exact learned candidate for a longer current input.
- Complete learned phrases must still sort by native user-dictionary weight across translator routes.
- Fixed candidates must retain their positions.
- Partial candidates must retain their original relative order.
- Wrapped candidates must be memorized only when they consume the complete current input.

---

### Task 1: Exact learned-candidate scope

**Files:**
- Modify: `lua/snow/candidate_priority.lua`
- Modify: `lua/snow/learned_priority.lua`
- Test: `spec/candidate_priority.test.lua`
- Test: `spec/learned_priority.test.lua`
- Test: `scripts/fixed-corpus/test/scheme-regressions.test.ts`

**Interfaces:**
- Produces: `candidate_priority.consumes_input(candidate, expected_length) -> boolean`.
- Produces: `learned_priority.prioritize(candidates, memory, cache, expected_length) -> Candidate[]`, where only exact candidates participate in learned ranking.

- [x] **Step 1: Write failing unit tests**

Add literal fixtures proving exact versus partial consumption and proving a high-weight partial user candidate remains in ordinary relative order behind a complete learned phrase.

- [x] **Step 2: Verify RED**

Run `lua spec/candidate_priority.test.lua; lua spec/learned_priority.test.lua`; observe the missing interface and incorrect partial promotion failures.

- [x] **Step 3: Implement exact learned scope**

Add `consumes_input`; pass current input length into learned prioritization; require exact consumption before explicit wrapped-candidate memorization.

- [x] **Step 4: Verify GREEN**

Run all Lua unit scripts, formatting, TypeScript checking, pinyin validation, and `bun run --cwd scripts test:corpus`.

- [x] **Step 5: Preserve upstream candidate routing**

Do not change `table_like.main`, `table_like.t12`, or add four-/five-code single-candidate scheme assertions.
