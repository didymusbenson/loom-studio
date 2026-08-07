# Milestone 2 — The Collaboration Layer

## Goal

Milestone 2 proves that Loom Studio can observe and coordinate external assistants without owning prompting, credentials, or the author's project.

The milestone is complete only when `docs/validation/milestone-2.json` is green. Automated criteria must pass; intentionally manual visual and interaction criteria require recorded human review.

## Product boundary

Authors keep prompting however they prefer. Studio provides project context, observes normalized activity, preserves sessions, presents proposed changes for review, and manages replaceable engines and adapters.

Studio must never require a provider login, API key, embedded provider chat, or vendor-specific project format.

## Implemented foundation

- Project Graph and document/revision spine from Milestone 1.
- Versioned Engine Pack API with detect, install, inspect, compile, upgrade, and remove operations.
- Generic filesystem and Claude Code engine packs.
- Deterministic runtime compiler and disposable capsules.
- Capability-based Assistant Adapter API and generic filesystem observer.
- Session metadata, normalized JSONL activity events, and persistence.
- Proposal creation, inspection, editing, rejection, acceptance, optional bookmarking, and stale-source detection.
- Milestone 2 API routes, validation manifest, integration tests, and an initial collapsible Collaborator Desk.

## Remaining product work

### Collaborator Desk

Make the secondary panel production-ready. It should show running assistants, connection and waiting states, current task, recent activity, and meaningful progress while keeping the manuscript primary.

### Live activity

Replace snapshot-style refresh behavior where practical with timely event flow. Normalize status, task, read, write, proposal, waiting, completion, and error events. Degrade honestly when an adapter cannot provide a capability.

### Proposal review

Complete the author-facing lifecycle: preview, compare changes, edit, approve, reject, apply, and optionally bookmark. Stale proposals must require an explicit conflict decision before overwriting newer author work.

### Engine Manager

Present installed engines, versions, install, upgrade, and removal actions. Removing an engine must not remove author content.

### Adapter Manager

Present connected adapters, capabilities, connection state, and health. Do not add credential management.

### Runtime Inspector

Show generated capsules, source fingerprint, and generation time. Runtime files are read-only derived artifacts; changes originate in the Project Graph or compiler.

### Multiple assistants

Represent simultaneous Claude, Codex, Gemini, local, and generic sessions without provider assumptions. The interface must distinguish absent capability from failure.

## Proposal lifecycle

```text
Proposal → Preview → Compare → Edit or Approve/Reject → Apply → Optional bookmark
                              ↘ stale source → explicit conflict decision
```

Proposals remain isolated from canonical author files until acceptance. Application goes through the normal safe document and revision paths.

## Completion gate

- All automated validation items pass on `milestone-2`.
- Manual Collaborator Desk review confirms a writer-first desktop and narrow-width experience.
- Milestone 1 authoring, archive, timeline, graph, and lifecycle behavior remains green.
- `PROJECT_STATE.md` reflects the final validation state.
- The branch remains unmerged until the user explicitly accepts and requests a merge.

