# Loom Studio Project State

Last updated: 2026-08-06

## Resume here

- Active branch: `milestone-2`
- Branch policy: long-running feature branch; do not merge into `main` until the validation manifest is green and the user explicitly requests it.
- Current milestone: Milestone 2 — The Collaboration Layer.
- Current focus: turn the implemented collaboration foundation into a complete writer-first product experience.
- Authoritative acceptance contract: `docs/validation/milestone-2.json`.

## Current status

Implemented and covered by initial tests:

- Project Graph, document engine, revision engine, and Milestone 1 authoring workflows.
- Engine Pack API and generic filesystem / Claude Code packs.
- Deterministic runtime capsule compiler.
- Capability-based Assistant Adapter API and generic filesystem observation.
- Session persistence and normalized activity events.
- Proposal isolation, editing, accept/reject, optional bookmark, and stale-source protection.
- Milestone 2 API routes and initial collapsible Collaborator Desk.

The validation manifest still reports `in-progress` and its acceptance entries remain pending. Existing tests demonstrate much of the foundation, but the manifest must not be marked green until each criterion has been deliberately verified.

## Remaining work

1. Finish the Collaborator Desk: running assistants, status, current task, waiting state, activity, and meaningful progress in a secondary writer-first panel.
2. Replace snapshot-style activity refresh with timely live updates where practical.
3. Finish the proposal review UI: preview, comparison, editing, approve/reject/apply, optional bookmark, and explicit stale-conflict handling.
4. Build the Engine Manager for installed version, install, upgrade, and removal.
5. Build the Adapter Manager for capabilities, connection status, and health—without credentials.
6. Build the Runtime Inspector for generated capsules, source fingerprint, and generation time.
7. Polish simultaneous multi-assistant display and honest capability degradation.
8. Run every automated validation item and record results; then complete intentional manual UX review.

## Next task

Inspect the current Collaborator Desk event-refresh path and implement live activity delivery from the generic filesystem adapter through the existing local transport. Preserve the secondary-panel interaction and add integration coverage for status, task, read, write, proposal, waiting, completion, and error events.

## Known risks and constraints

- As of 2026-08-06, `npm run check` stops during TypeScript compilation at `src/runtime.ts:56-57`: indexed path segments are inferred as possibly `undefined`. This predates the documentation handoff and must be fixed before the validation suite can be considered green.
- Filesystem observation is the universal baseline; do not imply pause, resume, usage, or approval-continuation support when an adapter cannot provide it.
- Proposal acceptance must never silently overwrite a stale source.
- Generated `.loom/` coordination state must not become canonical project truth or leak into author documents.
- UI work must not regress the Milestone 1 manuscript, archive, timeline, graph, or lifecycle flows.
- Manual visual acceptance is still required for desktop and narrow-width Collaborator Desk behavior.

## Standard verification

```bash
npm install
npm run check
```

For focused Milestone 2 work, run the relevant tests during iteration, then run the full check before committing.
