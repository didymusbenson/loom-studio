# Architecture

Loom Studio is a local application that opens Loom projects wherever they live on disk. The application repository never becomes the parent history for a user's manuscripts.

## System boundaries

```text
Loom Studio UI
    ↓
Local HTTP API + filesystem watcher
    ↓
Project model ─ Document engine ─ Revision engine
    ↓                ↓                 ↓
 loom.json       Markdown/YAML         Git
```

Optional assistant support is layered beside this spine:

```text
Engine pack → materializes assistant-specific project instructions
Adapter     → observes or communicates with a running assistant
```

An engine pack and an adapter are independent. A project can use either, both, or neither.

## Canonical state

Canonical project truth remains on disk:

- `loom.json` defines project structure and version.
- Markdown plus YAML frontmatter stores prose and structured metadata.
- Assets remain ordinary files.
- Git stores durable revision history and alternate timelines.

The in-memory project graph is derived state. It is rebuilt from files after startup, saves, external edits, and timeline changes.

## Package responsibilities

The first implementation is intentionally compact, but boundaries are already represented as modules:

- `model.ts`: shared contracts only.
- `documents.ts`: safe Markdown/frontmatter reads and writes.
- `project.ts`: discovery and graph construction.
- `revisions.ts`: author-facing history and timelines backed by Git.
- `server.ts`: local transport, watching, and orchestration.
- `public/`: author interface; it does not parse project files or invoke Git directly.

As the codebase grows, these modules can become packages without changing their responsibilities.

## Live updates

The baseline live contract is filesystem watching, because it works for humans, editors, Claude, Codex, local models, scripts, and tools that do not expose semantic hooks. Provider adapters may add richer events later, but the application must remain correct without them.

Writes are atomic and directory watching is debounced. This prevents partial reads and limits repaint storms.

## Revision vocabulary

| Author term | Git primitive |
|---|---|
| Bookmark | Commit |
| Timeline | Branch |
| Switch timeline | Checkout/switch |
| Proposed revision | Short-lived review branch |

The revision engine owns this translation. The user interface never needs commit hashes or branch syntax.

## Security and privacy

- The server binds locally by default.
- Document paths are resolved beneath the selected project root before writes.
- Model-provider credentials are outside the application boundary.
- Real projects under `local-projects/`, `projects/`, or `workspaces/` are ignored by the tool repository.
