# ADR 0001: Project Graph as the source of truth

- Status: Accepted
- Date: 2026-08-06

## Context

Loom projects contain prose, structured metadata, assets, and relationships. Both the author interface and external assistants need a coherent view of that material. Making Markdown layout, a UI store, or a provider-specific context format authoritative would couple the project to one consumer and allow derived representations to diverge.

## Decision

The provider-neutral Project Graph is the authoritative application model derived from canonical project files. Studio views, diagnostics, runtime compilation, and assistant context consume that graph. Files and Git history remain the durable storage representation; the graph is rebuilt when those files change.

## Consequences

- Every consumer receives one consistent model of the project.
- Provider and interface changes do not change the author-owned format.
- The graph must be deterministic, tolerant of malformed input, and refreshed after saves, external edits, and timeline changes.
- Features must not create a competing canonical store.

