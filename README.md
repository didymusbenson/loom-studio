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

Real writing projects do not belong in this repository. Local projects may be placed under `local-projects/` for development, but that directory is ignored by Git. Production projects may live anywhere on disk and are opened by path.

## Initial milestone

**Milestone 0: A Good Writing App**

1. Open a Loom project.
2. Discover and index manuscript and reference documents.
3. Edit Markdown while preserving frontmatter.
4. Watch the filesystem and reflect external changes.
5. Initialize and use Git through author-facing concepts.
6. Create bookmarks and alternate timelines.
7. Keep a project graph synchronized with canonical files.

See [`docs/architecture.md`](docs/architecture.md) for the system boundaries.
