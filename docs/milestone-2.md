# Milestone 2 — Engine Packs and Assistant Observation

> Current milestone contract and remaining-work summary: [`architecture/milestone-2.md`](architecture/milestone-2.md). Acceptance status is authoritative in [`validation/milestone-2.json`](validation/milestone-2.json).

## Product boundary

Loom Studio does **not** become an embedded AI client. Authors continue prompting through Claude Code, Codex, Gemini CLI, local tools, desktop apps, terminals, editors, or any workflow they prefer.

Studio owns project stewardship:

- project files and graph
- runtime compilation
- assistant-visible project instructions
- live activity normalization
- proposed-write review
- session history
- engine and adapter configuration

Prompting belongs to the assistant. Project stewardship belongs to Loom Studio.

## Architecture

```text
Loom project files
      ↓
Project graph
      ├── Studio UI
      └── Runtime compiler
              ↓
          Engine pack
              ↓
External assistant process
              ↓
        Optional adapter events
              ↓
 Activity / session / proposal store
              ↓
           Studio UI
```

## Engine packs

An engine pack is a versioned, provider-oriented set of generated instructions, templates, hooks, and runtime configuration. It never owns the manuscript format and never requires Studio to hold provider credentials.

Required pack operations:

- detect compatibility
- install into a project
- compile runtime artifacts
- inspect installed version
- upgrade explicitly
- remove without deleting author content

The first packs are:

- `generic-filesystem`: assistant-neutral instructions and runtime capsules
- `claude-code`: Claude Code conventions and optional hook bridge

## Assistant adapters

Adapters observe an external assistant. They do not authenticate on behalf of the user and do not own prompting.

Adapters declare capabilities rather than promising uniform behavior:

- activity events
- session lifecycle
- file-read events
- proposed writes
- approval continuation
- tool identity
- usage reporting

The generic adapter relies on filesystem, proposal folders, and session event files. Provider-specific adapters may enrich this with native hooks.

## Canonical project additions

All generated and transient assistant state lives under `.loom/`:

```text
.loom/
  engines/
  runtime/
  sessions/
  proposals/
  assistant-scratch/
```

Canonical author documents remain ordinary Markdown, YAML, JSON, and assets outside this transient area.

## Proposal protocol

Assistants may propose changes without directly overwriting canonical documents by writing a proposal bundle:

```text
.loom/proposals/<proposal-id>/
  proposal.json
  files/
    manuscript/chapter-008.md
```

Studio can preview, accept, reject, or edit the proposed files. Acceptance writes through the normal document engine and may create a bookmark.

## Definition of done

Milestone 2 is complete when:

1. Engine pack and adapter contracts are stable and tested.
2. Generic filesystem pack installs and compiles project runtime capsules.
3. Claude Code pack installs without requiring Anthropic API credentials.
4. Studio displays normalized live activity from an external session event stream.
5. Sessions persist locally inside the project and can be reopened.
6. Proposed writes can be previewed, accepted, or rejected.
7. No prompting UI or provider authentication is required.
8. Existing Milestone 1 authoring workflows remain intact.
