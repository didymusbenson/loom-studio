import fs from "node:fs/promises";
import path from "node:path";
import { LoomManifestSchema, type LoomDocument, type LoomManifest, type ProjectGraph } from "./model.js";
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
  return LoomManifestSchema.parse(JSON.parse(raw));
}

function underAny(file: string, roots: string[]): boolean {
  return roots.some(root => file === root || file.startsWith(`${root}${path.sep}`) || file.startsWith(`${root}/`));
}

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
  documents.sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
  const references: Record<string, LoomDocument[]> = {};
  for (const document of documents.filter(d => d.kind === "reference")) (references[document.category] ??= []).push(document);
  const characters = (references.characters ?? []).map(doc => ({ id: doc.id, name: String(doc.frontmatter.name ?? doc.title), path: doc.path }));
  const links: ProjectGraph["links"] = [];
  for (const doc of documents) {
    const present = Array.isArray(doc.frontmatter.characters_present) ? doc.frontmatter.characters_present : [];
    for (const name of present) {
      const character = characters.find(c => c.name.toLowerCase() === String(name).toLowerCase());
      if (character) links.push({ from: doc.id, to: character.id, type: "features" });
    }
  }
  return { manifest, graph: { documents, manuscripts: documents.filter(d => d.kind === "manuscript"), references, characters, links, generatedAt: new Date().toISOString() } };
}
