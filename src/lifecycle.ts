import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { ensureRepository, createBookmark } from "./revisions.js";

export interface CreateProjectInput {
  name: string;
  parent: string;
  slug?: string;
  type?: "book" | "session";
  genre?: string;
}

export interface RecentProject {
  root: string;
  name: string;
  lastOpenedAt: string;
}

const stateDir = path.join(os.homedir(), ".loom-studio");
const recentFile = path.join(stateDir, "recent-projects.json");

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("Project name must contain letters or numbers");
  return slug;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temp, file);
}

export async function listRecentProjects(): Promise<RecentProject[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(recentFile, "utf8")) as RecentProject[];
    const existing: RecentProject[] = [];
    for (const project of parsed) {
      try { await fs.access(path.join(project.root, "loom.json")); existing.push(project); } catch { /* stale entry */ }
    }
    return existing.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)).slice(0, 20);
  } catch { return []; }
}

export async function rememberProject(root: string, name: string): Promise<void> {
  const resolved = path.resolve(root);
  const existing = (await listRecentProjects()).filter(item => item.root !== resolved);
  existing.unshift({ root: resolved, name, lastOpenedAt: new Date().toISOString() });
  await writeJson(recentFile, existing.slice(0, 20));
}

export async function forgetProject(root: string): Promise<void> {
  const resolved = path.resolve(root);
  await writeJson(recentFile, (await listRecentProjects()).filter(item => item.root !== resolved));
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required");
  const parent = path.resolve(input.parent);
  const root = path.join(parent, input.slug ? slugify(input.slug) : slugify(name));
  try {
    const entries = await fs.readdir(root);
    if (entries.length) throw new Error(`The project folder is not empty: ${root}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const folders = ["manuscript", "characters", "world", "relationships", "observations", "notes", "assets", ".loom/archive", ".loom/trash", ".loom/recovery"];
  await Promise.all(folders.map(folder => fs.mkdir(path.join(root, folder), { recursive: true })));

  const manifest = {
    loom_version: "1.0.0",
    project_id: crypto.randomUUID(),
    name,
    type: input.type ?? "book",
    genre: input.genre?.trim() || "unspecified",
    created: new Date().toISOString(),
    manuscript: { roots: ["manuscript"], order: [] },
    references: {
      characters: ["characters"],
      world: ["world"],
      relationships: ["relationships"],
      observations: ["observations"],
      notes: ["notes"]
    },
    archive: { root: ".loom/archive", trash: ".loom/trash" },
    ui: { default_reference_category: "characters" }
  };

  await writeJson(path.join(root, "loom.json"), manifest);
  await fs.writeFile(path.join(root, ".gitignore"), ".loom/recovery/\n.claude/settings.local.json\n", "utf8");
  await fs.writeFile(path.join(root, "manuscript", "chapter-001.md"), `---\nid: ${crypto.randomUUID()}\ntype: chapter\ntitle: Chapter One\norder: 1\nstatus: draft\ntags: []\n---\n\n# Chapter One\n\n`, "utf8");
  await fs.writeFile(path.join(root, "world", "world.md"), `---\nid: ${crypto.randomUUID()}\ntype: world\ntitle: World\ntags: []\n---\n\n# World\n\n`, "utf8");
  await ensureRepository(root);
  await createBookmark(root, "Project created");
  await rememberProject(root, name);
  return root;
}
