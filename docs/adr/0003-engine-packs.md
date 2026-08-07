# ADR 0003: Provider scaffolding lives in versioned engine packs

- Status: Accepted
- Date: 2026-08-06

## Context

External assistants expect different instruction names, hooks, configuration, and runtime layouts. Encoding these details in the project model or Studio core would create provider lock-in and force core releases whenever a tool changes.

## Decision

Use versioned engine packs for assistant-specific scaffolding and runtime compilation conventions. Packs implement detect, install, inspect, compile, upgrade, and remove operations. Packs may generate coordination files but may not own or delete author content.

## Consequences

- Providers can be added, upgraded, or removed independently of the project format.
- A project may use an engine pack, an adapter, both, or neither.
- Pack lifecycle behavior requires compatibility checks and tests that canonical documents remain unchanged.
- The first proving packs are generic filesystem and Claude Code; neither requires provider credentials.

