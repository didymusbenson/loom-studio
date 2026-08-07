# Architecture Decision Index

Architectural Decision Records preserve the reason behind durable choices. Accepted ADRs remain historical records; if a decision changes, add a superseding ADR and link both records.

| ADR | Status | Decision |
|---|---|---|
| [0001 — Project Graph as source of truth](../adr/0001-project-graph.md) | Accepted | Studio features and assistant runtimes derive from one provider-neutral graph. |
| [0002 — Disposable runtime capsules](../adr/0002-runtime-capsules.md) | Accepted | Assistant-facing runtime files are deterministic, replaceable artifacts. |
| [0003 — Versioned engine packs](../adr/0003-engine-packs.md) | Accepted | Provider-oriented scaffolding is isolated in replaceable packs. |
| [0004 — Observational assistant adapters](../adr/0004-observational-adapters.md) | Accepted | Studio observes capability-based external sessions and does not own prompting or credentials. |

## Adding a decision

Use the next four-digit number. Include status, context, decision, and consequences. Keep implementation details in code documentation unless they express a boundary future work must preserve.

