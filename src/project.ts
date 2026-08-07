import fs from "node:fs/promises";
import path from "node:path";
import { LoomManifestSchema, type LoomDocument, type LoomManifest, type ProjectDiagnostic, type ProjectGraph } from "./model.js";
import { readDocument } from "./documents.js";

async function walkMarkdown(root: string, relative = ""): Promise<string[]> {
  const absolute = path.join(root, relative);
  let entries;
  try { entries = await fs.readdir(absolute, { withFileTypes: true }); } catch { return []; }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walkMarkdown(root, child));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(child);
  }
  return files;
}

export async function loadManifest(root: string): Promise<LoomManifest> {
  const file = path.join(root, "loom.json");
  const raw = await fs.readFile(file, "utf8").catch(() => { throw new Error(`No loom.json found in ${root}`); });
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("loom.json is not valid JSON. Open Project Repair to recover it."); }
  const result = LoomManifestSchema.safeParse(parsed);
  if (!result.success) throw new Error(`loom.json needs repair: ${result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  return result.data;
}

function underAny(file: string, roots: string[]): boolean {
  return roots.some(root => file === root || file.startsWith(`${root}${path.sep}`) || file.startsWith(`${root}/`));
}

function normalized(value: unknown): string { return String(value ?? "").trim().toLowerCase(); }

export async function indexProject(root: string): Promise<{ manifest: LoomManifest; graph: ProjectGraph }> {
  const manifest = await loadManifest(root);
  const files = await walkMarkdown(root);
  const documents: LoomDocument[] = [];
  for (const file of files) {
    const isManuscript = underAny(file, manifest.manuscript.roots);
    let category = "project";
    if (!isManuscript) {
      for (const [name, roots] of Object.entries(manifest.references)) {
        if (underAny(file, roots.filter(root => !root.includes("*")))) { category = name; break; }
      }
    }
    documents.push(await readDocument(root, file, isManuscript ? "manuscript" : "reference", isManuscript ? "manuscript" : category));
  }

  const explicitOrder = new Map(manifest.manuscript.order.map((id, index) => [id, index]));
  documents.sort((a, b) => (explicitOrder.get(a.id) ?? a.order) - (explicitOrder.get(b.id) ?? b.order) || a.path.localeCompare(b.path));
  const references: Record<string, LoomDocument[]> = {};
  for (const document of documents.filter(d => d.kind === "reference")) (references[document.category] ??= []).push(document);
  const characters = documents.filter(d => d.type === "character").map(doc => ({ id: doc.id, name: String(doc.frontmatter.name ?? doc.title), path: doc.path }));
  const locations = documents
    .filter(d => d.type === "location" || normalized(d.frontmatter.category) === "location")
    .map(doc => ({ id: doc.id, name: String(doc.frontmatter.name ?? doc.title), path: doc.path }));
  const links: ProjectGraph["links"] = [];
  const diagnostics: ProjectDiagnostic[] = [];
  const ids = new Map<string, LoomDocument[]>();
  for (const doc of documents) (ids.get(doc.id) ?? ids.set(doc.id, []).get(doc.id)!).push(doc);
  for (const [id, matches] of ids) if (matches.length > 1) diagnostics.push({ severity: "error", code: "duplicate-id", message: `Document id ${id} is used ${matches.length} times`, documentId: id });

  const resolveDocument = (value: unknown): LoomDocument | undefined => {
    const key = normalized(value);
    return documents.find(doc => doc.id === String(value) || normalized(doc.title) === key || normalized(doc.frontmatter.name) === key);
  };

  for (const doc of documents) {
    for (const warning of doc.warnings) diagnostics.push({ severity: "warning", code: "document-warning", message: warning, path: doc.path, documentId: doc.id });
    const present = Array.isArray(doc.frontmatter.characters_present) ? doc.frontmatter.characters_present : [];
    for (const name of present) {
      const character = characters.find(c => normalized(c.name) === normalized(name) || c.id === String(name));
      if (character) links.push({ from: doc.id, to: character.id, type: "features" });
      else diagnostics.push({ severity: "warning", code: "missing-character", message: `Character ${String(name)} is referenced but has no character sheet`, path: doc.path, documentId: doc.id });
    }
    const pov = doc.frontmatter.pov;
    if (pov) {
      const character = characters.find(c => normalized(c.name) === normalized(pov) || c.id === String(pov));
      if (character) links.push({ from: doc.id, to: character.id, type: "pov" });
      else diagnostics.push({ severity: "warning", code: "missing-pov", message: `POV character ${String(pov)} has no character sheet`, path: doc.path, documentId: doc.id });
    }
    const locationValue = doc.frontmatter.location;
    if (locationValue) {
      const location = locations.find(item => normalized(item.name) === normalized(locationValue) || item.id === String(locationValue));
      if (location) links.push({ from: doc.id, to: location.id, type: "located-at" });
      else diagnostics.push({ severity: "info", code: "missing-location", message: `Location ${String(locationValue)} has no location sheet`, path: doc.path, documentId: doc.id });
    }
    if (doc.type === "relationship") {
      for (const endpoint of ["from", "to"] as const) {
        const value = doc.frontmatter[endpoint];
        if (!value) continue;
        const target = resolveDocument(value);
        if (target) links.push({ from: doc.id, to: target.id, type: `relationship-${endpoint}` });
        else diagnostics.push({ severity: "warning", code: "broken-link", message: `Relationship endpoint ${String(value)} does not resolve to a project document`, path: doc.path, documentId: doc.id });
      }
    }
    const referencesValue = Array.isArray(doc.frontmatter.references) ? doc.frontmatter.references : [];
    for (const value of referencesValue) {
      const target = resolveDocument(value);
      if (target) links.push({ from: doc.id, to: target.id, type: "references" });
      else diagnostics.push({ severity: "warning", code: "broken-link", message: `Reference ${String(value)} does not resolve to a project document`, path: doc.path, documentId: doc.id });
    }
  }

  const tagMap = new Map<string, string[]>();
  for (const doc of documents) for (const tag of doc.tags) (tagMap.get(tag) ?? tagMap.set(tag, []).get(tag)!).push(doc.id);
  const tags = [...tagMap].map(([name, documentIds]) => ({ name, documentIds })).sort((a, b) => a.name.localeCompare(b.name));

  return {
    manifest,
    graph: {
      documents,
      manuscripts: documents.filter(d => d.kind === "manuscript"),
      references,
      characters,
      locations,
      tags,
      links,
      diagnostics,
      generatedAt: new Date().toISOString()
    }
  };
}
