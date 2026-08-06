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
