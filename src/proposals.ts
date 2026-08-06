import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { readDocument, writeDocument } from "./documents.js";
import { createBookmark } from "./revisions.js";

export type ProposalStatus = "pending" | "stale" | "accepted" | "rejected";
export interface ProposedFile { path: string; baseModifiedAt?: string; frontmatter: Record<string, unknown>; body: string; }
export interface ProposalBundle { id: string; title: string; summary: string; createdAt: string; sessionId?: string; status: ProposalStatus; files: ProposedFile[]; }

const rootFor = (root: string) => path.join(root, ".loom", "proposals");
const fileFor = (root: string, id: string) => path.join(rootFor(root), `${id}.json`);
function safeRelative(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) throw new Error("Proposal path must stay inside the project");
  return normalized;
}

export async function createProposal(root: string, input: Omit<ProposalBundle, "id" | "createdAt" | "status"> & { id?: string }): Promise<ProposalBundle> {
  const bundle: ProposalBundle = {
    id: input.id ?? crypto.randomUUID(), title: input.title, summary: input.summary,
    createdAt: new Date().toISOString(), sessionId: input.sessionId, status: "pending",
    files: input.files.map(file => ({ ...file, path: safeRelative(file.path), frontmatter: file.frontmatter ?? {}, body: String(file.body ?? "") })),
  };
  await fs.mkdir(rootFor(root), { recursive: true });
  await fs.writeFile(fileFor(root, bundle.id), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return bundle;
}

async function readBundle(root: string, id: string): Promise<ProposalBundle> {
  return JSON.parse(await fs.readFile(fileFor(root, id), "utf8")) as ProposalBundle;
}
async function saveBundle(root: string, bundle: ProposalBundle): Promise<void> {
  await fs.writeFile(fileFor(root, bundle.id), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}

export async function inspectProposal(root: string, id: string): Promise<ProposalBundle> {
  const bundle = await readBundle(root, id);
  if (bundle.status !== "pending" && bundle.status !== "stale") return bundle;
  let stale = false;
  for (const file of bundle.files) {
    if (!file.baseModifiedAt) continue;
    try {
      const current = await readDocument(root, file.path, file.path.startsWith("manuscript/") ? "manuscript" : "reference", "project");
      if (current.modifiedAt !== file.baseModifiedAt) stale = true;
    } catch { stale = true; }
  }
  const status: ProposalStatus = stale ? "stale" : "pending";
  if (bundle.status !== status) { bundle.status = status; await saveBundle(root, bundle); }
  return bundle;
}

export async function listProposals(root: string): Promise<ProposalBundle[]> {
  let entries: string[] = [];
  try { entries = await fs.readdir(rootFor(root)); } catch { return []; }
  const bundles: ProposalBundle[] = [];
  for (const entry of entries.filter(name => name.endsWith(".json"))) {
    try { bundles.push(await inspectProposal(root, entry.slice(0, -5))); } catch { /* tolerate incomplete external proposal */ }
  }
  return bundles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function rejectProposal(root: string, id: string): Promise<ProposalBundle> {
  const bundle = await readBundle(root, id); bundle.status = "rejected"; await saveBundle(root, bundle); return bundle;
}

export async function editProposal(root: string, id: string, files: ProposedFile[]): Promise<ProposalBundle> {
  const bundle = await readBundle(root, id);
  if (bundle.status === "accepted" || bundle.status === "rejected") throw new Error("This proposal is already closed");
  bundle.files = files.map(file => ({ ...file, path: safeRelative(file.path), frontmatter: file.frontmatter ?? {}, body: String(file.body ?? "") }));
  bundle.status = "pending"; await saveBundle(root, bundle); return inspectProposal(root, id);
}

export async function acceptProposal(root: string, id: string, options: { allowStale?: boolean; bookmark?: string } = {}): Promise<ProposalBundle> {
  const bundle = await inspectProposal(root, id);
  if (bundle.status === "accepted" || bundle.status === "rejected") throw new Error("This proposal is already closed");
  if (bundle.status === "stale" && !options.allowStale) throw new Error("This proposal is stale because its source files changed; review and explicitly allow the overwrite");
  for (const file of bundle.files) await writeDocument(root, file.path, file.frontmatter, file.body);
  bundle.status = "accepted"; await saveBundle(root, bundle);
  if (options.bookmark) await createBookmark(root, options.bookmark);
  return bundle;
}
