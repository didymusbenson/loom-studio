# Loom Studio

A local-first writing environment for structured, AI-assisted fiction projects.

Loom Studio keeps manuscripts and story state in readable files, provides author-friendly revision history and alternate timelines, and supports AI tools through optional adapters rather than binding projects to one model provider.

## Principles

- Projects remain ordinary folders of Markdown, YAML frontmatter, assets, and Git history.
- Loom Studio is the tool and system, not the container for a user's writing projects.
- The application remains useful with no AI session running.
- Assistant support is capability-based and adapter-driven.
- Engine packs scaffold and configure assistant-specific project runtimes.
- Git powers bookmarks, proposed revisions, and alternate timelines, but Git terminology stays out of the author-facing UI.

## Repository boundary

Real writing projects do not belong in this repository. Local projects may be placed under `local-projects/` for development, but that directory is ignored by Git. Production projects may live anywhere on disk and are opened by absolute path.

The committed `fixtures/sample-project` is synthetic and exists only for tests and the first-run demo.

## Run it

Requirements: Node.js 20+ and Git.

```bash
npm install
npm start
```

Open `http://localhost:4173`. Studio starts with the synthetic fixture. To start with another project:

```bash
LOOM_PROJECT="/absolute/path/to/project" npm start
```

The folder must contain a valid `loom.json`. See [`docs/project-format.md`](docs/project-format.md).

For development:

```bash
npm run dev
npm run check
```

## Milestone 0: A Good Writing App

The first vertical slice implements:

1. Opening any valid Loom project by path.
2. Discovering and ordering manuscript and reference documents.
3. Editing manuscript Markdown with preserved YAML frontmatter.
4. Read-first reference panes with explicit edit/save mode.
5. Debounced filesystem watching and browser live reload.
6. A derived project graph rebuilt from canonical files.
7. Git initialization behind author-facing controls.
8. Named bookmark save points.
9. Creation and switching of alternate timelines.
10. A synthetic fixture and automated tests covering document, graph, and revision behavior.

## Current interface

```text
category rail | persistent reference pane | manuscript centerpiece | story contents
```

The current UI is intentionally dependency-light. It proves the authoring, file, graph, and revision spine before richer editors, adapter activity, engine-pack management, tracked revisions, or Loom View are layered on.

## Documentation

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/project-format.md`](docs/project-format.md)
