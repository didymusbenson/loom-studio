# Loom Studio Agent Guide

Read this file before changing the repository. Then read `PROJECT_STATE.md`, the relevant documents under `docs/architecture/`, and the active validation manifest.

## Product identity

Loom Studio is the author's workspace, not an AI client. Authors may prompt with Claude Code, Codex, Gemini CLI, desktop applications, local models, or any other tool. Studio observes and coordinates those collaborators while protecting the project.

> Prompting belongs to the assistant. Project stewardship belongs to Loom Studio.

The project is permanent. Generated runtimes are disposable. Assistants are replaceable.

## Invariants

- The Project Graph is the source of truth consumed by Studio features and runtime compilation.
- Canonical author work remains in portable, readable project files and Git history.
- Provider-specific behavior stays behind engine-pack or assistant-adapter contracts.
- Studio must remain useful when no assistant is installed or running.
- Preserve unknown metadata and prose when editing documents.
- Diagnose and repair malformed project data instead of crashing or silently discarding it.
- Keep Git and provider plumbing out of normal author-facing language.
- Treat ordinary deletion as Archive; permanent deletion requires an explicit irreversible warning.

## Never

- Require provider login or Anthropic/OpenAI API keys.
- Store or manage provider credentials.
- Embed a provider chat interface as a required workflow.
- Couple the project format to an AI vendor.
- Treat `.loom/runtime`, sessions, proposals, or assistant scratch data as canonical author truth.
- Edit generated runtime capsules by hand; change their compiler inputs and regenerate them.
- Merge a milestone branch into `main` unless the user explicitly asks.

## Writer-first interface

The interface should feel like a manuscript binder, trapper keeper, archival tab set, or editorial desk—not a developer IDE. The manuscript remains primary. Assistant activity belongs in a secondary Collaborator Desk and must never become a chat-first centerpiece.

Use author vocabulary: bookmark, timeline, compare versions, bring across, archive, and unbookmarked changes. Avoid raw Git hashes, refs, conflict markers, stack traces, and provider internals in ordinary workflows.

## Architecture boundaries

- `src/model.ts`: shared project contracts.
- `src/documents.ts`: safe Markdown/frontmatter reads and writes.
- `src/project.ts`: discovery and Project Graph construction.
- `src/revisions.ts`: author-facing history and timelines.
- `src/engine-packs.ts`: versioned engine-pack lifecycle.
- `src/runtime.ts`: deterministic, replaceable runtime compilation.
- `src/assistants.ts`: capability-based observational adapter and session events.
- `src/proposals.ts`: isolated proposed-write lifecycle and conflict checks.
- `src/milestone2-routes.ts`: Milestone 2 local API surface.
- `public/`: author-facing interface; it must not parse project files or invoke Git directly.

## Working agreement

1. Confirm the active branch and preserve unrelated changes.
2. Read `PROJECT_STATE.md` and `docs/validation/milestone-2.json` before selecting work.
3. Make the smallest coherent change that advances the validation contract.
4. Add or update tests for behavior and regressions.
5. Run `npm run check` before committing.
6. Update `PROJECT_STATE.md` whenever the current focus, completed work, known issues, or next task changes.
7. Record a new ADR for a durable architectural decision; do not rewrite accepted history without noting supersession.

## Documentation map

- Product constitution: `docs/architecture/vision.md`
- Current milestone contract: `docs/architecture/milestone-2.md`
- Decision index: `docs/architecture/decisions.md`
- Architecture decisions: `docs/adr/`
- Resume point: `PROJECT_STATE.md`
- Executable acceptance contract: `docs/validation/milestone-2.json`
- Project file format: `docs/project-format.md`

