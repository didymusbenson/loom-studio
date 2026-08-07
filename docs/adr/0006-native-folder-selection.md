# ADR 0006: Native folder selection belongs to the local application

- Status: Proposed
- Date: 2026-08-07

## Context

Creating a Loom project currently requires an author to type an absolute parent-folder path. That exposes a developer-oriented filesystem detail in a writer-first workflow and is especially difficult for people who do not routinely use a terminal.

A browser-only directory input cannot solve this boundary cleanly. Browser security intentionally withholds an absolute host path, while Loom Studio's local server needs that path to create and manage an ordinary project folder anywhere on disk.

## Decision

The local Loom Studio application owns native folder selection. The Project Binder Shelf's **Create New** flow asks the local HTTP API to open the operating system's folder dialog, then fills the existing parent-folder field with the selected path.

- Windows uses `FolderBrowserDialog` through PowerShell.
- macOS uses the system folder chooser through `osascript`.
- Linux tries `zenity`, then `kdialog`.
- Canceling is a normal result and leaves the creation form open; platform-specific cancellation is distinguished from selector failures.
- Manual path entry remains available as a fallback when a native selector is unavailable.
- The server binds to loopback, rejects non-loopback Host/Origin values, requires a browser-preflighted application header, and permits only one selector at a time.
- Folder selection stays local and does not upload, scan, or persist a selected folder until the author creates the project.

## Consequences

- Ordinary authors can choose a location without knowing or copying its absolute path.
- The server, rather than browser JavaScript, remains responsible for host filesystem access.
- Linux desktop installations need either Zenity or KDialog for the native experience.
- The folder-selection endpoint must remain part of the loopback-only local application boundary.
- A future packaged shell such as Tauri or Electron may replace the platform commands without changing the UI/API contract.
