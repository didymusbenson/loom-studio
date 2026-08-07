# Loom Studio Project State

Last updated: 2026-08-06

## Resume here

- Active branch: `milestone-2`
- Branch policy: long-running feature branch; do not merge into `main` until the validation manifest is green and the user explicitly requests it.
- Current milestone: Milestone 2 — The Collaboration Layer.
- Current focus: validate the collaboration foundation criterion by criterion, then close the live-activity and writer-facing review gaps surfaced by that audit.
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

Validation orchestration began on 2026-08-06. `npm run check` now passes all 31 tests after fixing the runtime capsule type guard, correcting stale assertions, and adding document-transaction and Collaborator Desk coverage. A passing automated suite is not yet Milestone 2 signoff: live delivery, adapter normalization, restart persistence, engine-file safety, and manual responsive review still need explicit evidence or implementation.

Milestone 1 follow-up validation is also substantially complete. Direct browser runs passed its project-library, restart-state, reference-tab, and irreversible-deletion workflows. The run exposed and fixed missing Timeline options and Rename controls that had stopped the client during startup. Only the explicitly human `M1-UX-001` visual-design signoff remains pending; Codex captured preparatory desktop and narrow-width evidence.

The first human-feedback batch is implemented: semantic Markdown reference reading, whole-sheet Read/Edit/Save/Discard behavior, contextual reference creation, project-backed character/location/relationship selectors, transactional author-facing reference rename with stable hidden identity, clearer Save version language, less crowded recent-project actions, and a responsive/inert Collaborator Desk shell. Browser verification passed at desktop and 375px widths without content overlap or console errors.

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

Implement live activity delivery from the generic filesystem adapter through the existing local transport. Preserve in-progress proposal edits, fold task/waiting/completion/error events into visible session state, and add integration coverage for the complete normalized event set.

## Known risks and constraints

- The Claude Code engine pack currently writes and removes root `CLAUDE.md` and `.claude/settings.local.json` without preserving pre-existing user files; engine lifecycle validation must cover and resolve that ownership hazard.
- External session and event JSON is cast without structural validation, and missing event IDs are regenerated on each read; adapter normalization needs a durable schema and stable identity behavior.
- The Collaborator Desk currently polls every three seconds, can replace unsaved proposal textarea content, and does not receive external `.loom/sessions` writes through the existing project watcher.
- Runtime inspection, adapter health/capability management, side-by-side proposal comparison, and simultaneous-assistant presentation remain incomplete.
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
