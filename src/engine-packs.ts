import fs from "node:fs/promises";
import path from "node:path";
import { compileRuntime } from "./runtime.js";

export interface InstalledEnginePack {
  id: string;
  version: string;
  installedAt: string;
  files: string[];
}

export interface EnginePack {
  id: string;
  displayName: string;
  version: string;
  detect(projectRoot: string): Promise<boolean>;
  inspect(projectRoot: string): Promise<InstalledEnginePack | null>;
  install(projectRoot: string): Promise<InstalledEnginePack>;
  compile(projectRoot: string): Promise<string[]>;
  upgrade(projectRoot: string): Promise<InstalledEnginePack>;
  remove(projectRoot: string): Promise<void>;
}

const engineRoot = (projectRoot: string, id: string) => path.join(projectRoot, ".loom", "engines", id);

async function writeManagedFile(projectRoot: string, relative: string, content: string): Promise<void> {
  const file = path.join(projectRoot, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

abstract class FilesystemEnginePack implements EnginePack {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly version: string;
  protected abstract files(): Record<string, string>;

  async detect(projectRoot: string): Promise<boolean> { return (await this.inspect(projectRoot)) !== null; }

  async inspect(projectRoot: string): Promise<InstalledEnginePack | null> {
    try {
      return JSON.parse(await fs.readFile(path.join(engineRoot(projectRoot, this.id), "install.json"), "utf8")) as InstalledEnginePack;
    } catch { return null; }
  }

  async install(projectRoot: string): Promise<InstalledEnginePack> {
    const managed = this.files();
    for (const [relative, content] of Object.entries(managed)) await writeManagedFile(projectRoot, relative, content);
    const installed: InstalledEnginePack = {
      id: this.id,
      version: this.version,
      installedAt: new Date().toISOString(),
      files: Object.keys(managed).sort(),
    };
    await fs.mkdir(engineRoot(projectRoot, this.id), { recursive: true });
    await fs.writeFile(path.join(engineRoot(projectRoot, this.id), "install.json"), `${JSON.stringify(installed, null, 2)}\n`, "utf8");
    await this.compile(projectRoot);
    return installed;
  }

  async compile(projectRoot: string): Promise<string[]> { return compileRuntime(projectRoot, this.id); }
  async upgrade(projectRoot: string): Promise<InstalledEnginePack> { await this.remove(projectRoot); return this.install(projectRoot); }

  async remove(projectRoot: string): Promise<void> {
    const installed = await this.inspect(projectRoot);
    for (const relative of installed?.files ?? []) await fs.rm(path.join(projectRoot, relative), { force: true });
    await fs.rm(engineRoot(projectRoot, this.id), { recursive: true, force: true });
  }
}

export class GenericFilesystemPack extends FilesystemEnginePack {
  readonly id = "generic-filesystem";
  readonly displayName = "Generic Filesystem Loom";
  readonly version = "1.0.0";

  protected files(): Record<string, string> {
    return {
      ".loom/engines/generic-filesystem/INSTRUCTIONS.md": `# Loom Project Instructions\n\nThis project is managed by Loom Studio. Canonical author documents remain ordinary files. Read .loom/runtime/runtime-context.md before working. To propose changes without overwriting canonical documents, create a bundle under .loom/proposals/<id>/. Prompting remains in your normal assistant interface.`,
      ".loom/engines/generic-filesystem/event-protocol.md": `# Session Event Protocol\n\nWrite session metadata to .loom/sessions/<session-id>/session.json and append one JSON object per line to events.jsonl. Supported event types: session-started, session-ended, status, task, read, write, proposal, waiting, completed, error.`,
    };
  }
}

export class ClaudeCodePack extends FilesystemEnginePack {
  readonly id = "claude-code";
  readonly displayName = "Claude Code Loom";
  readonly version = "1.0.0";

  protected files(): Record<string, string> {
    return {
      "CLAUDE.md": `# Loom Studio Project\n\nRead .loom/runtime/runtime-context.md before substantial work. Canonical documents are author-owned. Prefer proposal bundles under .loom/proposals for broad or destructive changes. Session hooks may append normalized JSONL events under .loom/sessions. Do not request or store Anthropic API credentials for Loom Studio.`,
      ".claude/settings.local.json": `${JSON.stringify({ hooks: {}, loomStudio: { runtime: ".loom/runtime/runtime-context.md", proposals: ".loom/proposals", sessions: ".loom/sessions" } }, null, 2)}\n`,
      ".loom/engines/claude-code/hook-protocol.md": `# Optional Claude Code Hook Bridge\n\nHooks may translate Claude Code lifecycle and tool activity into Loom Studio JSONL session events. The adapter is observational; users continue prompting in Claude Code.`,
    };
  }
}

export const builtinEnginePacks = [new GenericFilesystemPack(), new ClaudeCodePack()] as const;
export const getEnginePack = (id: string): EnginePack => {
  const pack = builtinEnginePacks.find(candidate => candidate.id === id);
  if (!pack) throw new Error(`Unknown engine pack: ${id}`);
  return pack;
};
