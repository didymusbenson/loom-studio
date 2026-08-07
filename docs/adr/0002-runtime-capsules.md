# ADR 0002: Runtime capsules are disposable

- Status: Accepted
- Date: 2026-08-06

## Context

Assistants benefit from compact, tool-specific guides, cast summaries, manuscript context, hooks, and configuration. Treating those files as project truth would pollute portable author projects and make them dependent on current assistant products.

## Decision

Compile assistant-facing capsules deterministically from the Project Graph into `.loom/runtime/`. Runtime artifacts are read-only outputs that may be deleted and regenerated. Changes must be made to canonical project inputs or the compiler, never directly to a capsule.

## Consequences

- Assistant runtimes can evolve without migrating author documents.
- Deleting `.loom/runtime/` cannot lose creative work.
- Compilation must preserve canonical files and produce repeatable output for the same inputs.
- Runtime inspection should expose provenance such as engine, source fingerprint, and generation time.

