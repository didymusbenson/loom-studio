# ADR 0004: Assistant adapters are observational and capability-based

- Status: Accepted
- Date: 2026-08-06

## Context

Authors already use assistants through terminals, desktop apps, editors, CLIs, and local tools. Providers expose unequal hooks and subscription models. An embedded chat or uniform provider API would make Studio responsible for prompting, authentication, and the lowest common denominator.

## Decision

Assistant adapters observe externally controlled sessions and normalize the capabilities they actually provide: activity, session lifecycle, file reads, proposed writes, approval continuation, tool identity, and usage reporting. Studio does not authenticate, prompt, or impersonate the user through an adapter. Filesystem events are the portable baseline; native hooks may enrich them.

## Consequences

- Authors keep their preferred assistant workflow and subscriptions.
- Studio can display multiple providers through one collaborator model.
- The interface must degrade honestly when a capability is unavailable.
- Adapters must tolerate incomplete or malformed external events.
- Provider credential management and required embedded chat remain outside the product boundary.

