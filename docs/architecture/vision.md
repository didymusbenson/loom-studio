# Loom Studio Product Vision

## Purpose

Loom Studio is a local-first workspace for authors who use one or more AI assistants without surrendering ownership of their work to any assistant or provider.

The durable product is the project: readable prose, structured metadata, assets, relationships, and history. Studio organizes and protects that project. External assistants participate as replaceable collaborators.

> Prompting belongs to the assistant. Project stewardship belongs to Loom Studio.

## Product model

```text
Author
  ↓
Loom project
  ↓
Project Graph
  ├─→ Studio interface
  └─→ Runtime compiler
         ↓
      Engine pack
         ↓
      Assistant adapter
         ↓
      External assistant
```

The Project Graph is the common source of truth. Studio views and assistant runtimes derive from it. Generated runtime artifacts may always be deleted and rebuilt.

## Experience

Studio should feel like a cleanly organized trapper keeper or manuscript binder: labeled dividers, folders, index cards, archival tabs, manuscript pages, and a calm editorial desk. It must not feel like an IDE with literary decoration.

The manuscript is the centerpiece. References remain close at hand. The Collaborator Desk is secondary: it lets an author see who is working, what they are doing, whether they are waiting, and what they propose without turning Studio into a terminal or chat client.

## Permanent boundaries

1. Canonical project truth lives in ordinary files and Git history.
2. Projects may live anywhere on disk and do not live inside the Studio source repository.
3. Studio remains fully useful without an assistant.
4. Provider-specific behavior is isolated behind adapters and engine packs.
5. Studio does not require provider login, provider API keys, or an embedded chat surface.
6. Unknown metadata and prose survive Studio edits.
7. Parsing is tolerant: diagnose and repair rather than crash or discard.
8. Git is an implementation detail presented as bookmarks, timelines, comparisons, and restoration.
9. Normal deletion means Archive; permanent deletion exists only in Trash behind an explicit warning.
10. Runtime capsules, sessions, proposals, caches, and assistant scratch space are replaceable coordination state—not author truth.

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

## Success

An author can move or archive a project, open it years later, change assistants, regenerate every runtime artifact, and retain the full creative work and history. Better assistant products strengthen Loom Studio rather than threaten it because Studio solves the separate problem of project stewardship.

