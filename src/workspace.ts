import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

export interface StudioWorkspacePaths {
  root: string;
  project: string;
  sessions: string;
  proposals: string;
  runtime: string;
  logs: string;
  cache: string;
}

const digest = (value: string) => crypto.createHash("sha256").update(path.resolve(value)).digest("hex").slice(0, 20);

export function studioDataRoot(): string {
  return path.resolve(process.env.LOOM_STUDIO_HOME ?? path.join(os.homedir(), ".loom-studio"));
}

export function workspaceForProject(projectRoot: string): StudioWorkspacePaths {
  const project = path.join(studioDataRoot(), "projects", digest(projectRoot));
  return {
    root: studioDataRoot(),
    project,
    sessions: path.join(project, "sessions"),
    proposals: path.join(project, "proposals"),
    runtime: path.join(project, "runtime"),
    logs: path.join(project, "logs"),
    cache: path.join(project, "cache"),
  };
}

export async function ensureWorkspace(projectRoot: string): Promise<StudioWorkspacePaths> {
  const workspace = workspaceForProject(projectRoot);
  await Promise.all([
    workspace.sessions,
    workspace.proposals,
    workspace.runtime,
    workspace.logs,
    workspace.cache,
  ].map(directory => fs.mkdir(directory, { recursive: true })));
  const identity = {
    projectRoot: path.resolve(projectRoot),
    workspaceVersion: 1,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(workspace.project, "project.json"), `${JSON.stringify(identity, null, 2)}\n`, "utf8");
  return workspace;
}

export function safeProjectPath(projectRoot: string, relativePath: string): string {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("Path escapes the author project");
  return resolved;
}
