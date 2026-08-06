import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RevisionStatus } from "./model.js";

const exec = promisify(execFile);

async function git(root: string, args: string[], allowFailure = false): Promise<string> {
  try {
    const { stdout } = await exec("git", ["-C", root, ...args], { encoding: "utf8" });
    return stdout.trim();
  } catch (error) {
    if (allowFailure) return "";
    throw new Error(`Git command failed: git ${args.join(" ")}`, { cause: error });
  }
}

export async function ensureRepository(root: string): Promise<void> {
  if (await git(root, ["rev-parse", "--is-inside-work-tree"], true) === "true") return;
  await git(root, ["init", "-b", "main"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "Begin project"]);
}

export async function createBookmark(root: string, message: string): Promise<void> {
  if (!message.trim()) throw new Error("Bookmark message is required");
  await ensureRepository(root);
  await git(root, ["add", "-A"]);
  const staged = await git(root, ["diff", "--cached", "--quiet"], true);
  // `--quiet` emits no output whether clean or dirty; commit and tolerate clean trees.
  await git(root, ["commit", "--allow-empty", "-m", message.trim()]);
}

export function timelineRef(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("Timeline name must contain letters or numbers");
  return `timeline/${slug}`;
}

export async function createTimeline(root: string, name: string): Promise<string> {
  await ensureRepository(root);
  const ref = timelineRef(name);
  await git(root, ["switch", "-c", ref]);
  return ref;
}

export async function switchTimeline(root: string, name: string): Promise<void> {
  await git(root, ["switch", name]);
}

export async function revisionStatus(root: string): Promise<RevisionStatus> {
  const initialized = await git(root, ["rev-parse", "--is-inside-work-tree"], true) === "true";
  if (!initialized) return { initialized: false, timeline: null, dirty: false, bookmarks: [], timelines: [] };
  const timeline = await git(root, ["branch", "--show-current"], true) || null;
  const dirty = Boolean(await git(root, ["status", "--porcelain"], true));
  const log = await git(root, ["log", "--pretty=format:%H%x09%aI%x09%s", "-n", "50"], true);
  const bookmarks = log ? log.split("\n").map(line => { const [id = "", date = "", ...message] = line.split("\t"); return { id, date, message: message.join("\t") }; }) : [];
  const branchText = await git(root, ["for-each-ref", "--format=%(refname:short)", "refs/heads"], true);
  const timelines = branchText ? branchText.split("\n") : [];
  return { initialized, timeline, dirty, bookmarks, timelines };
}
