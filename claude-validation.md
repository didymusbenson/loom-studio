# Claude Validation Log — `milestone-1`

Automated error-checking log for the `milestone-1` branch (PR #2).

**Role:** watch-only. This log records findings from build + test runs on each
new commit pushed to `milestone-1`. It does **not** contain fixes — errors are
reported here for the author to address.

**Checks run per commit:**
- `npm run build` — TypeScript compile / typecheck (`tsc -p tsconfig.json`)
- `npm test` — test suite (`node --import tsx --test tests/**/*.test.ts`)

Environment: Node 22.x. Deps installed fresh per run in an isolated worktree.

Legend: ✅ pass · ❌ fail

---

## 2026-08-06T18:20:55Z — commit `2a0dcb7` (baseline)

> `test: cover milestone 1 lifecycle, archive, migration, and diagnostics`

| Check | Result |
|-------|--------|
| Build (`tsc`) | ❌ **FAIL** — 13 errors |
| Tests (`node --test`) | ✅ **PASS** — 10/10 |

### Build errors (13)

`src/documents.ts` — 13 errors. Property accesses on a value typed as
`{} | { [key: string]: any }` (frontmatter/`data` whose type isn't narrowed),
so TypeScript rejects each property read:

| Location | Error | Property |
|----------|-------|----------|
| `documents.ts:32:34` | TS2339 | `scene_number` |
| `documents.ts:32:62` | TS2339 | `chapter` |
| `documents.ts:32:85` | TS2339 | `order` |
| `documents.ts:35:63` | TS2339 | `type` |
| `documents.ts:36:87` | TS2339 | `type` |
| `documents.ts:37:33` | TS2339 | `id` |
| `documents.ts:37:64` | TS2339 | `id` |
| `documents.ts:37:88` | TS2339 | `id` |
| `documents.ts:39:42` | TS2339 | `tags` |
| `documents.ts:39:62` | TS2339 | `tags` |
| `documents.ts:46:31` | TS2339 | `title` |
| `documents.ts:48:32` | TS2339 | `status` |

`src/server.ts` — 1 error:

| Location | Error | Detail |
|----------|-------|--------|
| `server.ts:18:14` | TS2503 | `Cannot find namespace 'chokidar'` — chokidar v4 no longer exports a `chokidar` namespace for type annotations |

### Test results

All 10 tests pass (lifecycle, bookmarks, alternate timelines, timeline-name
normalization, archive, migration, diagnostics). No failures.

---

## 2026-08-06T18:31:42Z — commits `902aa85`, `0baf389`, `5a01e2e`, `91ab2dc`

Caught up on 4 commits pushed after the baseline (webhook delivery was down, so
these were picked up on a manual re-check). Each was built + tested individually.

| Commit | Subject | Build | Tests |
|--------|---------|-------|-------|
| `902aa85` | feat(archive): expose trash inventory | ❌ 13 errors | ✅ 10/10 |
| `0baf389` | fix(build): narrow parsed frontmatter before property access | ❌ 1 error | ✅ 10/10 |
| `5a01e2e` | fix(build): use chokidar FSWatcher type export | ✅ **0 errors** | ✅ 10/10 |
| `91ab2dc` | feat(manuscript): persist drag-to-reorder order metadata | ❌ 2 errors | ✅ 10/10 |

**Progression:** the two `fix(build)` commits cleared the whole backlog — build
was **fully green at `5a01e2e`** (`0baf389` fixed the 12 `documents.ts`
frontmatter errors; `5a01e2e` fixed the `chokidar` namespace error). The latest
commit `91ab2dc` then **reintroduced 2 build errors** — a regression.

### `91ab2dc` — build errors (2) ⚠️ regression vs green `5a01e2e`

New drag-to-reorder code reads properties off a value narrowed to `{ order: number }`,
so `chapter` and `scene_number` are rejected:

| Location | Error | Property |
|----------|-------|----------|
| `documents.ts:104:28` | TS2339 | `chapter` |
| `documents.ts:105:28` | TS2339 | `scene_number` |

### Test results
All 10 tests pass on every one of the 4 commits. No test failures introduced.

---

## 2026-08-06T18:49:51Z — commits `cca3aa9`, `6cb0621`, `ffc2502`

| Commit | Subject | Build | Tests |
|--------|---------|-------|-------|
| `cca3aa9` | style(ui): load milestone interaction polish | ❌ 2 errors | ✅ 11/11 |
| `6cb0621` | fix(build): keep reordered frontmatter indexable | ✅ **0 errors** | ✅ 11/11 |
| `ffc2502` | test(ui): enforce author-facing milestone one contract | ✅ **0 errors** | ✅ **14/14** |

**Progression:** `cca3aa9` still carried the 2 `documents.ts` errors from the
`91ab2dc` regression. `6cb0621` cleared them (`documents.ts:104-105` now
indexable again) — build green. `ffc2502` added tests (suite grew 11 → 14) and
stays green.

**Current HEAD `ffc2502`: ✅ build clean (0 errors), ✅ 14/14 tests passing.**

---

## 2026-08-06T19:12:19Z — gap fill: commits `ee4d441` … `f473dfc` (7 commits)

A delayed CI-failure webhook fired for check run `92699281252` on
`ee4d441` (`feat(manuscript): expose reorder endpoint`). Reconciling against the
branch history showed the previous log entry jumped straight from `91ab2dc` to
`cca3aa9`, skipping **7 commits** that landed during a container-down / webhook
outage window. Each skipped commit was built + tested individually here to close
the hole in the per-commit record.

| Commit | Subject | Build | Tests |
|--------|---------|-------|-------|
| `ee4d441` | feat(manuscript): expose reorder endpoint | ❌ 2 errors | ✅ 10/10 |
| `97bf279` | test(manuscript): validate persisted page order | ❌ 2 errors | ✅ 11/11 |
| `6af47a8` | feat(archive): include Trash in project snapshots | ❌ 2 errors | ✅ 11/11 |
| `11030b8` | feat(ui): complete author-ready organization workflows | ❌ 2 errors | ✅ 11/11 |
| `50ed4c8` | feat(ui): load milestone one workflow enhancements | ❌ 2 errors | ✅ 11/11 |
| `8d9a21b` | fix(ui): make milestone workflows operate through public APIs | ❌ 2 errors | ✅ 11/11 |
| `f473dfc` | style(ui): polish binder organization interactions | ❌ 2 errors | ✅ 11/11 |

### Build errors (identical across all 7 commits)

The same 2-error regression first introduced at `91ab2dc`, unchanged:

| Location | Error | Property |
|----------|-------|----------|
| `documents.ts:104:28` | TS2339 | `chapter` — not on type `{ order: number }` |
| `documents.ts:105:28` | TS2339 | `scene_number` — not on type `{ order: number }` |

### Reconciled timeline

The `documents.ts:104-105` regression ran **continuously** from `91ab2dc`
through this whole gap (`ee4d441` … `f473dfc`) and on into `cca3aa9`, then was
cleared by `6cb0621` — matching the fix already recorded in the entry above.
The suite grew 10 → 11 tests at `97bf279` and held at 11 through the rest of the
gap (it later reached 14 at `ffc2502`).

**CI-failure webhook on `ee4d441` is confirmed real but superseded:** its build
genuinely failed with the 2 errors above. Every commit in the gap was already
fixed downstream — current HEAD `ffc2502` remains ✅ build clean (0 errors),
✅ 14/14 tests. No open build failure on the branch tip.

---

## 2026-08-06T20:21:47Z — commits `62372e1` … `e607aae` (7 commits) ⚠️ tip is broken

Seven new commits since `ffc2502`. Each built + tested individually.

| Commit | Subject | Build | Tests |
|--------|---------|-------|-------|
| `62372e1` | feat(ui): complete author-ready binder workflows | ✅ 0 errors | ✅ 14/14 |
| `9684c05` | refactor(ui): consolidate milestone workflows into main application | ✅ 0 errors | ❌ **13/14** |
| `5806867` | test(ui): validate consolidated author-ready workflows | ✅ 0 errors | ✅ 14/14 |
| `ff01970` | chore(ui): remove superseded milestone workflow shim | ✅ 0 errors | ✅ 14/14 |
| `be2709a` | feat(graph): derive relationship references and broken-link diagnostics | ❌ **1 error** | ✅ 14/14 |
| `6479e1c` | test(graph): cover typed relationships and broken links | ❌ **3 errors** | ✅ 15/15 |
| `e607aae` | docs(validation): mark milestone one development complete | ❌ **3 errors** | ✅ 15/15 |

### Two separate regressions this range

**1. Test regression at `9684c05` (self-healed).** The workflow-consolidation
refactor broke one test — `not ok 12 - loads the author-ready workflow and
tactile binder styles` (AssertionError). Build stayed clean. The very next
commit `5806867` restored it to 14/14, so it did not reach the tip.

**2. Build regression at `be2709a` — still open at HEAD.** New graph code emits
relationship kinds `"relationship-from"` / `"relationship-to"`, but the kind
union in `project.ts` was never extended to include them:

| Location | Error | Detail |
|----------|-------|--------|
| `project.ts:93:63` | TS2322 | `"relationship-from" \| "relationship-to"` not assignable to union `"references" \| "relationship" \| "features" \| "pov" \| "located-at"` |

Then `6479e1c` added tests comparing against those same literals, so `tsc`
flags two more **TS2367 "no overlap"** errors in the test file (the union still
lacks the members):

| Location | Error | Detail |
|----------|-------|--------|
| `tests/milestone1.test.ts:102:38` | TS2367 | compares union with `"relationship-from"` — no overlap |
| `tests/milestone1.test.ts:103:38` | TS2367 | compares union with `"relationship-to"` — no overlap |

All 3 errors trace to one root cause (the missing union members) and persist
unchanged through `6479e1c` and `e607aae`.

**Current HEAD `e607aae`: ❌ build FAILS (3 errors), ✅ 15/15 tests.** Note the
tip commit message marks milestone-1 "development complete," but the TypeScript
build is red — the `project.ts` relationship-kind union needs the two new
members added (and the graph diagnostics tests will then typecheck). Reported
for the author to address; not fixed here (watch-only).

---

## 2026-08-06T20:45:04Z — CI root-cause: every run fails at setup, not at build/test

A CI-failure webhook fired for `62372e1` (check run `92705938059`, run
`31127806511`) — a commit this log records as ✅ build-clean, 14/14. Reproduced
CI's exact command locally (fresh `npm install` + `npm run check`) at `62372e1`:
**passes, exit 0, 0 errors, 14/14.** So the CI failure is not about the code.

Pulled the CI job log. The job dies in the `actions/setup-node@v4` step, before
`npm install` or `npm run check` ever run:

```
##[error]Dependencies lock file is not found in .../loom-studio.
Supported file patterns: package-lock.json,npm-shrinkwrap.json,yarn.lock
```

**Root cause (CI config, not code).** `.github/workflows/ci.yml` sets
`cache: npm` on `setup-node`, which requires a committed lock file to hash. The
repo commits **no** `package-lock.json` (confirmed: not in the tree, and not
gitignored — just never generated). So the cache step errors out and the job
fails **structurally on every commit**, regardless of build/test health.

**Implication for this log:** CI red/green is currently *uninformative* — it
never reaches `npm run check`. The build + test results recorded in every entry
above (run locally) are the ground truth for code health. The two are
independent:
- **Code health** — genuine build failures exist at `ee4d441`…`f473dfc` (2 errs,
  fixed by `6cb0621`) and `be2709a`…`e607aae` (3 errs, still open at HEAD).
- **CI health** — a separate, standing config bug: every run fails at
  `setup-node` for the missing lock file.

**Fix for the author (not applied — watch-only, and it's their branch + CI):**
either commit a `package-lock.json` (run `npm install` and commit the lockfile),
or drop `cache: npm` from `ci.yml`. Until then, CI cannot validate any commit.

---
