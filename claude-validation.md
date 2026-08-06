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
| Build (`tsc`) | ❌ **FAIL** — 14 errors |
| Tests (`node --test`) | ✅ **PASS** — 10/10 |

### Build errors (14)

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
