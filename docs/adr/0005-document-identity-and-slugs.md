# ADR 0005: Stable document identity and mutable author-facing slugs

- Status: Accepted
- Date: 2026-08-06

## Context

Authors expect renaming a character or other reference sheet to keep its visible name and filename in sync. Loom also needs a durable identity for Project Graph links, saved interface state, revision history, and external assistant context. Changing identity whenever a title changes would break those relationships and contradict the established stable-ID project contract.

## Decision

Every document keeps an immutable `id` in frontmatter. Studio does not present that technical identity as part of the ordinary rename workflow. The author-facing title, optional name, filename slug, and legacy name- or path-based references may change together through one document-engine transaction.

New structured relationships store the stable document ID. Project indexing remains backward-compatible with existing name-based relationships so portable projects do not require an eager migration.

## Consequences

- Renames preserve graph identity while matching the author's visible naming expectations.
- A rename must preflight filename collisions and update known legacy references safely.
- Mixed name- and ID-based projects remain readable.
- Unknown metadata and prose are preserved by document operations.
- Human-readable slugs are locators, not canonical identities.
