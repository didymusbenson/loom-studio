# Loom Studio Product Constitution

## Purpose

Loom Studio is a local-first writing environment for authors who use one or more AI assistants but refuse to make any assistant the owner of their work.

The durable product is the project: readable documents, assets, metadata, and history. Studio organizes and edits that project. Assistants are optional collaborators attached through replaceable adapters and engine packs.

## Experience

The interface should feel like a cleanly organized trapper-keeper for a living writing project: labeled dividers, folders, manuscript pages, index cards, tabs, paper texture, typewriter and newsprint cues. It must never feel like an IDE with literary decoration.

The manuscript is the centerpiece. Reference materials remain close at hand without competing with the page.

## Invariants

1. Canonical project truth lives in ordinary files and Git history.
2. Projects may live anywhere on disk and never need to live inside the Studio repository.
3. Studio is fully useful with no AI running.
4. Provider-specific behavior is isolated behind adapters or engine packs.
5. Unknown metadata and prose are preserved whenever Studio edits a document.
6. Parsing is tolerant: diagnose and repair instead of crashing.
7. Git is implementation detail. Authors see bookmarks, timelines, comparisons, and restoration.
8. Normal deletion means Archive. Permanent deletion exists only in Trash behind an explicit irreversible warning.
9. Silent autosave protects work; named bookmarks describe meaningful moments.
10. Migration support exists before project formats proliferate.

## Author vocabulary

| Internal concept | Author language |
|---|---|
| repository | project history |
| commit | bookmark |
| branch | timeline |
| checkout/switch | switch timeline |
| diff | compare versions |
| merge | bring across / accept |
| working tree dirty | unbookmarked changes |
| delete | archive |
| hard delete | permanently delete |

Raw hashes, refs, conflict markers, stack traces, and provider plumbing do not appear in normal workflows.

## Milestone 1 posture

Milestone 1 makes Studio trustworthy for real projects before assistant integration. It includes project creation/opening, schema validation and repair, stable typed documents, manuscript management, reference tabs, archive/trash, bookmarks and timelines, project diagnostics, live external-file handling, and an author-first visual system.

## Non-goals for Milestone 1

No chat surface, model login, provider credentials, live agent activity, pending-write interception, remote GitHub backup, runtime capsule compiler, or partial revision acceptance.
