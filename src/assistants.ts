import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type AssistantEventType =
  | "session-started"
  | "session-ended"
  | "status"
  | "task"
  | "read"
  | "write"
  | "proposal"
  | "waiting"
  | "completed"
  | "error";

export interface AssistantEvent {
  id: string;
  sessionId: string;
  type: AssistantEventType;
  at: string;
  summary: string;
  path?: string;
  detail?: Record<string, unknown>;
}

export interface AssistantSession {
  id: string;
  adapterId: string;
  displayName: string;
  startedAt: string;
  endedAt?: string;
  status: "active" | "waiting" | "completed" | "error" | "disconnected";
}

export interface AssistantAdapterCapabilities {
  activityEvents: boolean;
  sessionLifecycle: boolean;
  fileReads: boolean;
  proposedWrites: boolean;
  approvalContinuation: boolean;
  toolIdentity: boolean;
  usageReporting: boolean;
}

export interface AssistantAdapter {
  id: string;
  displayName: string;
  capabilities: AssistantAdapterCapabilities;
  detect(projectRoot: string): Promise<boolean>;
  listSessions(projectRoot: string): Promise<AssistantSession[]>;
  readEvents(projectRoot: string, sessionId: string, after?: string): Promise<AssistantEvent[]>;
}

const sessionRoot = (projectRoot: string) => path.join(projectRoot, ".loom", "sessions");

async function exists(file: string): Promise<boolean> {
  try { await fs.access(file); return true; } catch { return false; }
}

export class GenericFilesystemAdapter implements AssistantAdapter {
  readonly id = "generic-filesystem";
  readonly displayName = "Generic Filesystem Observer";
  readonly capabilities: AssistantAdapterCapabilities = {
    activityEvents: true,
    sessionLifecycle: true,
    fileReads: true,
    proposedWrites: true,
    approvalContinuation: false,
    toolIdentity: false,
    usageReporting: false,
  };

  async detect(projectRoot: string): Promise<boolean> {
    return exists(sessionRoot(projectRoot));
  }

  async listSessions(projectRoot: string): Promise<AssistantSession[]> {
    let entries;
    try { entries = await fs.readdir(sessionRoot(projectRoot), { withFileTypes: true }); } catch { return []; }
    const sessions: AssistantSession[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const raw = await fs.readFile(path.join(sessionRoot(projectRoot), entry.name, "session.json"), "utf8");
        sessions.push(JSON.parse(raw) as AssistantSession);
      } catch { /* tolerate incomplete external sessions */ }
    }
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async readEvents(projectRoot: string, sessionId: string, after?: string): Promise<AssistantEvent[]> {
    const eventFile = path.join(sessionRoot(projectRoot), sessionId, "events.jsonl");
    let raw;
    try { raw = await fs.readFile(eventFile, "utf8"); } catch { return []; }
    const events: AssistantEvent[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as AssistantEvent;
        if (!event.id) event.id = crypto.randomUUID();
        if (!after || event.at > after) events.push(event);
      } catch { /* one malformed external line must not break the activity feed */ }
    }
    return events.sort((a, b) => a.at.localeCompare(b.at));
  }
}

export async function ensureSession(projectRoot: string, session: Omit<AssistantSession, "id" | "startedAt"> & { id?: string; startedAt?: string }): Promise<AssistantSession> {
  const value: AssistantSession = {
    ...session,
    id: session.id ?? crypto.randomUUID(),
    startedAt: session.startedAt ?? new Date().toISOString(),
  };
  const root = path.join(sessionRoot(projectRoot), value.id);
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "session.json"), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.appendFile(path.join(root, "events.jsonl"), "", "utf8");
  return value;
}

export async function appendAssistantEvent(projectRoot: string, event: Omit<AssistantEvent, "id" | "at"> & { id?: string; at?: string }): Promise<AssistantEvent> {
  const value: AssistantEvent = { ...event, id: event.id ?? crypto.randomUUID(), at: event.at ?? new Date().toISOString() };
  const root = path.join(sessionRoot(projectRoot), value.sessionId);
  await fs.mkdir(root, { recursive: true });
  await fs.appendFile(path.join(root, "events.jsonl"), `${JSON.stringify(value)}\n`, "utf8");
  return value;
}
