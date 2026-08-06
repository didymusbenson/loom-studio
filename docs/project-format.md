# Loom Project Format 1.0

A Loom project is an independent directory. It may be its own Git repository and may live anywhere on disk.

## Required manifest

The root contains `loom.json`:

```json
{
  "loom_version": "1.0.0",
  "name": "Project Name",
  "type": "book",
  "genre": "fantasy",
  "manuscript": { "roots": ["manuscript"] },
  "references": {
    "characters": ["characters"],
    "world": ["world"],
    "project": ["project"]
  },
  "ui": { "default_reference_category": "characters" }
}
```

`loom_version` is required so Studio can migrate projects without guessing their historical schema.

## Documents

All Markdown files beneath configured roots are discoverable. Manuscript files are ordered by:

1. `scene_number`
2. `chapter`
3. `order`
4. path name

Structured fields required by the application belong in YAML frontmatter. Prose remains free Markdown.

Example:

```markdown
---
title: The Door Under the Rain
chapter: 1
scene_number: 1
status: draft
characters_present:
  - Mara Vale
---

The chapter begins here.
```

Studio parses tolerantly. Invalid optional metadata produces warnings rather than making the document unreadable.

## Graph projection

The project graph is reconstructed from canonical files. Milestone 0 projects:

- documents into manuscript and reference collections,
- character documents into character nodes,
- `characters_present` values into scene-to-character links.

Future schema versions may add explicit relationships, observations, locations, assets, runtime capsules, and knowledge-state edges without replacing Markdown as the interchange format.

## Project-local runtime material

Assistant-specific files may exist in a project, for example `.claude/`, `AGENTS.md`, or generated runtime capsules. They are part of an engine pack, not the durable project-format core. Studio must continue opening the project when those files are absent.
