# Fixed Candidate Corpus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible, privacy-safe, ignored candidate corpus from local and public Rime fixed/shortcut tables without changing the current Shenyun fixed tables.

**Architecture:** A tracked YAML manifest describes source families, resolution rules, and per-file adapters. Focused TypeScript modules resolve sources read-only, normalize each source to deterministic JSONL, and aggregate provenance and compact statistics under `cache/fixed-corpus/`; only a small Markdown summary is tracked.

**Tech Stack:** TypeScript, Node.js built-ins, `tsx`, `node:test`, `js-yaml`, existing npm package in `scripts/`.

**Spec:** `docs/superpowers/specs/2026-09-27-fixed-candidate-corpus-design.md`

## Global Constraints

- Never mutate a scanned local repository or run `pull`, `reset`, or cleanup inside it.
- Exclude `*.userdb*`, `sync/`, user dictionaries, private phrases, logs, backups, and build artifacts.
- Keep repositories, JSONL, provenance, and detailed reports under ignored `cache/fixed-corpus/`.
- Preserve original code, source-relative path, line, rank, weight, revision, and family on every record.
- Missing optional sources produce diagnostics and do not abort; missing required current-repository sources fail.
- Do not alter `snow_jiandao.fixed.txt` or `snow_sanpin.fixed.txt` in this phase.

## Review Focus

- UTF-8 BOM, CRLF, comments, YAML headers, and blank lines must not shift reported line numbers.
- Apostrophes and `/` suffixes must be preserved in `originalCode` while only declared markers are removed from `normalizedCode`.
- A broad include pattern must never override the global privacy deny-list.
- Two derivative repositories in one family must count as two sources but one family in aggregate coverage.
- A missing Git executable or unavailable network must leave already resolved local sources usable and clearly report unresolved optional sources.

---

### Task 1: Normalized record contract and explicit-code parsers

**Files:**
- Create: `scripts/fixed-corpus/types.ts`
- Create: `scripts/fixed-corpus/parsers.ts`
- Create: `scripts/fixed-corpus/test/parsers.test.ts`
- Modify: `scripts/package.json`

**Interfaces:**
- Produces: `CorpusRecord`, `ParseDiagnostic`, `ParseContext`, `ParseResult` types.
- Produces: `parseRimeTable(text, context)`, `parseOrderedFixed(text, context)`, `parseCustomPhrase(text, context)`, and `classifyRecord(record)`.

- [ ] **Step 1: Write failing parser contract tests**

Add tests named `parses Rime rows with weights and physical lines`, `expands ordered fixed candidates with ranks`, `preserves marked custom phrase codes`, and `reports malformed non-comment rows`. Assert exact `word`, `originalCode`, `normalizedCode`, `line`, `rank`, `weight`, `wordLength`, `codeLength`, `category`, and diagnostics.

- [ ] **Step 2: Run the parser tests and verify red**

Run: `npm run test:corpus -- --test-name-pattern="parser|fixed|phrase|malformed"`

Expected: FAIL because `types.ts` and `parsers.ts` do not exist.

- [ ] **Step 3: Implement the record types and three explicit parsers**

Use code-point word length (`Array.from`), physical 1-based lines, declared marker stripping from `ParseContext.codeMarkers`, and deterministic category/level classification. Keep malformed rows in `diagnostics` rather than silently discarding them.

- [ ] **Step 4: Run parser tests and type checking**

Run: `npm run test:corpus`

Expected: all Task 1 tests PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- scripts/package.json scripts/fixed-corpus/types.ts scripts/fixed-corpus/parsers.ts scripts/fixed-corpus/test/parsers.test.ts
git commit -m "feat: 定义固顶候选语料格式"
```

### Task 2: Manifest, environment expansion, and privacy gate

**Files:**
- Create: `config/fixed-corpus-sources.yaml`
- Create: `scripts/fixed-corpus/manifest.ts`
- Create: `scripts/fixed-corpus/test/manifest.test.ts`

**Interfaces:**
- Consumes: `ParseContext` from Task 1.
- Produces: `CorpusManifest`, `SourceDefinition`, `SourceInput`, `loadManifest(path, environment)`, `expandCandidatePath(value, environment)`, `isAllowedSourcePath(relativePath, input, globalPolicy)`.

- [ ] **Step 1: Write failing manifest and privacy tests**

Test environment expansion for `%APPDATA%`, `${FIXED_CORPUS_INPUTMETHOD_ROOT}`, and repository-relative paths. Test that exact `sbxh.dict.yaml` is allowed while `build/sbxh.schema.yaml`, `sync/x/sbxh.dict.yaml`, `foo.userdb/x`, `snow_pinyin.user.dict.yaml`, and an unlisted `custom_phrase.txt` are denied even when an include pattern matches.

- [ ] **Step 2: Run manifest tests and verify red**

Run: `npm run test:corpus -- --test-name-pattern="manifest|privacy|environment"`

Expected: FAIL because the manifest module is absent.

- [ ] **Step 3: Implement the manifest loader and deny-first path policy**

Define manifest schema version 1. Treat the global deny-list as absolute, normalize separators to `/`, and reject `..` traversal before matching input patterns.

- [ ] **Step 4: Add the initial source manifest**

Define current Ice/Snow tables, Moqi/Wanxiang, Pindu, JDhe, Fast-Xhup, static Sbxh files, KeyTao, Xingmao, Tianxingjian, Moran, Molong, and confirmed public KeyTao derivatives. Give every source a stable `id` and `family`; use environment-based local roots plus public repository fallback rather than embedding a user home path.

- [ ] **Step 5: Run tests and validate the actual manifest**

Run: `npm run test:corpus`

Expected: all tests PASS and the real YAML manifest loads without diagnostics.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- config/fixed-corpus-sources.yaml scripts/fixed-corpus/manifest.ts scripts/fixed-corpus/test/manifest.test.ts
git commit -m "feat: 配置固顶语料来源与隐私边界"
```

### Task 3: Read-only source resolution and encoder-derived records

**Files:**
- Create: `scripts/fixed-corpus/source-resolver.ts`
- Create: `scripts/fixed-corpus/encoder.ts`
- Create: `scripts/fixed-corpus/test/source-resolver.test.ts`
- Create: `scripts/fixed-corpus/test/encoder.test.ts`

**Interfaces:**
- Consumes: `SourceDefinition` and `SourceInput` from Task 2; parser types from Task 1.
- Produces: `resolveSource(definition, options): Promise<ResolvedSource>`, `listSourceFiles(source, input)`, `readSourceRevision(root)`, `parseEncoderRules(yaml)`, and `deriveWordCode(entry, rules, charCodes)`.

- [ ] **Step 1: Write failing source resolution tests**

Use temporary local repositories/ordinary directories. Assert local path precedence, no mutation of a dirty local repo, stable Git revision capture, SHA-256 fallback for non-Git directories, optional-missing diagnostics, and repository cache destination selection without performing a network clone.

- [ ] **Step 2: Run resolver tests and verify red**

Run: `npm run test:corpus -- --test-name-pattern="source|revision|optional"`

Expected: FAIL because the resolver is absent.

- [ ] **Step 3: Implement read-only resolution**

Use argument-array child processes, never shell-built Git commands. Existing local candidates are read directly. Public fallback uses a shallow clone only inside `cache/fixed-corpus/repositories/<id>`; offline mode never attempts network access.

- [ ] **Step 4: Write failing encoder rule tests**

Cover Rime formulas `AaAbBaBb`, `AaBaCa`, `AaBaCaCb`, and `AaBaCaZa`; assert missing character codes produce diagnostics rather than fabricated output.

- [ ] **Step 5: Implement encoder parsing and derivation**

Support only the rule tokens exercised by the collected schemas. Mark generated records `derived: true`, preserve the formula and contributing character codes in metadata, and reject unsupported formula tokens explicitly.

- [ ] **Step 6: Run all corpus tests and type checking**

Run: `npm run test:corpus`

Expected: all tests PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- scripts/fixed-corpus/source-resolver.ts scripts/fixed-corpus/encoder.ts scripts/fixed-corpus/test/source-resolver.test.ts scripts/fixed-corpus/test/encoder.test.ts
git commit -m "feat: 只读解析固顶语料来源"
```

### Task 4: Deterministic collection, provenance, and family summaries

**Files:**
- Create: `scripts/fixed-corpus/collector.ts`
- Create: `scripts/fixed-corpus/summary.ts`
- Create: `scripts/fixed-corpus/test/collector.test.ts`

**Interfaces:**
- Consumes: all Task 1-3 interfaces.
- Produces: `collectCorpus(manifest, options): Promise<CollectionResult>`, `writeJsonLines(records, path)`, `summarizeCorpus(records, sources)`, and `renderSummaryMarkdown(summary)`.

- [ ] **Step 1: Write failing deterministic collection tests**

Build two fixture sources in one family plus one independent family. Assert stable record ordering, byte-identical repeated JSONL output, exact source/family coverage for a shared word, per-source files plus aggregate output, diagnostics for malformed rows, and provenance with revisions and file hashes but no absolute home path.

- [ ] **Step 2: Run collector tests and verify red**

Run: `npm run test:corpus -- --test-name-pattern="collection|deterministic|family|provenance"`

Expected: FAIL because collector modules are absent.

- [ ] **Step 3: Implement deterministic collection and summaries**

Sort sources by manifest order and records by source path, physical line, code, word, and rank. Keep generation time out of deterministic data files; if recorded, place it only in a run metadata field excluded from equality tests.

- [ ] **Step 4: Run tests and inspect fixture outputs**

Run: `npm run test:corpus`

Expected: all tests PASS; fixture aggregate distinguishes source count from family count.

- [ ] **Step 5: Commit Task 4**

```powershell
git add -- scripts/fixed-corpus/collector.ts scripts/fixed-corpus/summary.ts scripts/fixed-corpus/test/collector.test.ts
git commit -m "feat: 汇总可追溯固顶候选语料"
```

### Task 5: CLI, real-source run, and tracked compact report

**Files:**
- Create: `scripts/fixed-corpus/cli.ts`
- Create: `scripts/fixed-corpus/README.md`
- Create: `reports/fixed-corpus-summary.md`
- Modify: `scripts/package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `collectCorpus` and `renderSummaryMarkdown` from Task 4.
- Produces: `npm run corpus:collect` and reusable CLI flags `--manifest`, `--cache`, `--offline`, `--input-method-root`.

- [ ] **Step 1: Write failing CLI integration test**

Invoke the CLI against fixture sources and assert exit 0, normalized per-source JSONL, aggregate JSONL, provenance, JSON summary, and Markdown summary. Add a second assertion that a required missing source exits nonzero while optional missing sources are reported.

- [ ] **Step 2: Run CLI test and verify red**

Run: `npm run test:corpus -- --test-name-pattern="CLI|required"`

Expected: FAIL because the CLI does not exist.

- [ ] **Step 3: Implement CLI and package commands**

Add `corpus:collect` and `test:corpus`. Ensure `cache/fixed-corpus/` is explicitly ignored even though `cache` is already ignored, documenting the intent.

- [ ] **Step 4: Run all local tests**

Run: `npm run test:corpus`

Expected: all tests PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 5: Collect the real corpus**

Run: `npm run corpus:collect -- --input-method-root "D:\C2D\Desktop\Code\Lua\inputMethod"`

Expected: `cache/fixed-corpus/corpus.jsonl`, provenance, per-source files, and detailed summary are generated; unavailable optional sources are listed, not hidden.

- [ ] **Step 6: Audit requested example words and privacy**

Search generated JSONL for `一些`, `冲着`, and `下了`, and record source/family coverage in the tracked summary. Search provenance and tracked files for `userdb`, `sync/`, and the absolute user home path; only policy descriptions may mention denied names, and no private file may appear as an ingested input.

- [ ] **Step 7: Commit Task 5**

```powershell
git add -- .gitignore scripts/package.json scripts/fixed-corpus/cli.ts scripts/fixed-corpus/README.md reports/fixed-corpus-summary.md
git commit -m "feat: 生成固顶候选语料空间"
```

