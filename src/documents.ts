import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { DocumentTypeSchema, type DocumentKind, type LoomDocument } from "./model.js";

const titleFromPath = (filePath: string) => path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const words = (text: string) => (text.trim().match(/\b[\p{L}\p{N}’'-]+\b/gu) ?? []).length;

const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function markdownFiles(root: string, relative = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(root, child));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(child.replaceAll("\\", "/"));
  }
  return files;
}

async function atomicRawWrite(absolute: string, raw: string): Promise<void> {
  const temporary = `${absolute}.${crypto.randomUUID()}.loom-studio-tmp`;
  await fs.writeFile(temporary, raw, "utf8");
  await fs.rename(temporary, absolute);
}

function safePath(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const absolute = path.resolve(root, relativePath);
  if (absolute !== resolvedRoot && !absolute.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Document path escapes project root");
  return absolute;
}

function inferredType(kind: DocumentKind, category: string): LoomDocument["type"] {
  if (kind === "manuscript") return "chapter";
  const candidate = category.endsWith("s") ? category.slice(0, -1) : category;
  return DocumentTypeSchema.safeParse(candidate).success ? candidate as LoomDocument["type"] : category === "characters" ? "character" : "unknown";
}

export async function readDocument(root: string, relativePath: string, kind: DocumentKind, category: string): Promise<LoomDocument> {
  const absolute = safePath(root, relativePath);
  const [raw, stat] = await Promise.all([fs.readFile(absolute, "utf8"), fs.stat(absolute)]);
  const warnings: string[] = [];
  let data: Record<string, unknown> = {};
  let content = raw;
  try {
    const parsed = matter(raw);
    data = parsed.data as Record<string, unknown>;
    content = parsed.content;
  } catch (error) {
    warnings.push(`Frontmatter could not be parsed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  const orderValue = data.scene_number ?? data.chapter ?? data.order ?? Number.MAX_SAFE_INTEGER;
  const order = Number(orderValue);
  if (!Number.isFinite(order)) warnings.push("Invalid document order metadata");
  const typeResult = DocumentTypeSchema.safeParse(data.type ?? inferredType(kind, category));
  if (!typeResult.success) warnings.push(`Unknown document type: ${String(data.type)}`);
  const id = typeof data.id === "string" && data.id.trim() ? data.id : relativePath;
  if (id === relativePath) warnings.push("Missing stable document id; filename is being used temporarily");
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  return {
    id,
    path: relativePath.replaceAll("\\", "/"),
    kind,
    type: typeResult.success ? typeResult.data : "unknown",
    category,
    title: String(data.title ?? titleFromPath(relativePath)),
    order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
    status: String(data.status ?? "draft"),
    tags,
    frontmatter: data,
    body: content.replace(/^\n/, ""),
    raw,
    wordCount: words(content),
    modifiedAt: stat.mtime.toISOString(),
    warnings,
  };
}

export async function writeDocument(root: string, relativePath: string, frontmatter: Record<string, unknown>, body: string): Promise<void> {
  const absolute = safePath(root, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const merged = { ...frontmatter };
  if (!merged.id) merged.id = crypto.randomUUID();
  const output = matter.stringify(body.endsWith("\n") ? body : `${body}\n`, merged);
  const recovery = safePath(root, path.posix.join(".loom/recovery", `${relativePath.replaceAll(/[\\/]/g, "__")}.md`));
  await fs.mkdir(path.dirname(recovery), { recursive: true });
  await fs.writeFile(recovery, output, "utf8");
  const temporary = `${absolute}.${crypto.randomUUID()}.loom-studio-tmp`;
  await fs.writeFile(temporary, output, "utf8");
  await fs.rename(temporary, absolute);
  await fs.rm(recovery, { force: true });
}

export async function createDocument(root: string, relativePath: string, frontmatter: Record<string, unknown>, body = ""): Promise<void> {
  const absolute = safePath(root, relativePath);
  try { await fs.access(absolute); throw new Error(`A document already exists at ${relativePath}`); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeDocument(root, relativePath, { id: crypto.randomUUID(), status: "draft", tags: [], ...frontmatter }, body);
}

export interface CreateReferenceInput {
  category: string;
  type: LoomDocument["type"];
  title: string;
}

export async function createReferenceDocument(root: string, input: CreateReferenceInput): Promise<{ id: string; path: string }> {
  const title = input.title.trim();
  if (!title) throw new Error("A name is required");
  if (!DocumentTypeSchema.safeParse(input.type).success || ["chapter", "scene", "unknown"].includes(input.type)) throw new Error("Unsupported reference document type");
  const manifest = JSON.parse(await fs.readFile(safePath(root, "loom.json"), "utf8")) as { references?: Record<string, unknown> };
  const configured = manifest.references?.[input.category];
  if (!Array.isArray(configured)) throw new Error(`Reference category ${input.category} is not configured`);
  const referenceRoot = configured.find(value => typeof value === "string" && value.length > 0 && !value.includes("*"));
  if (typeof referenceRoot !== "string") throw new Error(`Reference category ${input.category} has no writable folder`);
  const slug = slugify(title);
  if (!slug) throw new Error("The name must contain at least one letter or number");
  const relativePath = path.posix.join(referenceRoot.replaceAll("\\", "/"), `${slug}.md`);
  const id = crypto.randomUUID();
  const frontmatter: Record<string, unknown> = { id, type: input.type, title, name: title, status: "draft", tags: [] };
  await createDocument(root, relativePath, frontmatter, `# ${title}\n\n`);
  return { id, path: relativePath };
}

export interface RenameReferencePlan {
  id: string;
  from: string;
  to: string;
  previousName: string;
  name: string;
  affectedPaths: string[];
}

function replaceReference(value: unknown, matches: Set<string>, replacement: string): unknown {
  if (typeof value === "string") return matches.has(value.trim().toLowerCase()) ? replacement : value;
  if (Array.isArray(value)) return value.map(item => replaceReference(item, matches, replacement));
  return value;
}

export async function renameReferenceDocument(root: string, relativePath: string, requestedName: string, dryRun = false): Promise<RenameReferencePlan> {
  const name = requestedName.trim();
  if (!name) throw new Error("A name is required");
  const files = await markdownFiles(root);
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (!files.includes(normalizedPath)) throw new Error(`Reference document not found: ${normalizedPath}`);
  const sourceAbsolute = safePath(root, normalizedPath);
  const sourceRaw = await fs.readFile(sourceAbsolute, "utf8");
  const source = matter(sourceRaw);
  const id = typeof source.data.id === "string" && source.data.id.trim() ? source.data.id : normalizedPath;
  const previousName = String(source.data.name ?? source.data.title ?? titleFromPath(normalizedPath));
  const folder = path.posix.dirname(normalizedPath);
  const slug = slugify(name);
  if (!slug) throw new Error("The name must contain at least one letter or number");
  const destination = path.posix.join(folder, `${slug}.md`);
  if (destination !== normalizedPath) {
    await fs.access(safePath(root, destination)).then(() => { throw new Error(`A document already exists at ${destination}`); }).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }

  const matches = new Set([previousName, String(source.data.title ?? ""), normalizedPath, `./${path.posix.basename(normalizedPath)}`].filter(Boolean).map(value => value.trim().toLowerCase()));
  const referenceFields = new Set(["characters_present", "pov", "location", "from", "to", "references"]);
  const originals = new Map<string, string>();
  const updates = new Map<string, string>();
  for (const file of files) {
    const absolute = safePath(root, file);
    const raw = file === normalizedPath ? sourceRaw : await fs.readFile(absolute, "utf8");
    const parsed = matter(raw);
    let changed = false;
    const data = { ...parsed.data } as Record<string, unknown>;
    if (file === normalizedPath) {
      data.title = name;
      if ("name" in data || ["character", "location", "world"].includes(String(data.type))) data.name = name;
      changed = String(parsed.data.title ?? "") !== name || ("name" in data && String(parsed.data.name ?? "") !== name);
    }
    for (const field of referenceFields) {
      if (!(field in data)) continue;
      const next = replaceReference(data[field], matches, id);
      if (JSON.stringify(next) !== JSON.stringify(data[field])) { data[field] = next; changed = true; }
    }
    if (changed) {
      originals.set(file, raw);
      updates.set(file, matter.stringify(parsed.content, data));
    }
  }
  const plan: RenameReferencePlan = { id, from: normalizedPath, to: destination, previousName, name, affectedPaths: [...updates.keys()] };
  if (dryRun) return plan;

  const written: string[] = [];
  let renamed = false;
  try {
    for (const [file, raw] of updates) {
      await atomicRawWrite(safePath(root, file), raw);
      written.push(file);
    }
    if (destination !== normalizedPath) { await fs.rename(sourceAbsolute, safePath(root, destination)); renamed = true; }
    return plan;
  } catch (error) {
    if (renamed) await fs.rename(safePath(root, destination), sourceAbsolute).catch(() => undefined);
    for (const file of written.reverse()) {
      const original = originals.get(file);
      if (original !== undefined) await atomicRawWrite(safePath(root, file), original).catch(() => undefined);
    }
    throw error;
  }
}

export async function renameDocument(root: string, from: string, to: string): Promise<void> {
  const source = safePath(root, from);
  const destination = safePath(root, to);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);
}

export async function duplicateDocument(root: string, from: string, to: string): Promise<void> {
  const source = await readDocument(root, from, from.startsWith("manuscript/") ? "manuscript" : "reference", "project");
  await createDocument(root, to, { ...source.frontmatter, id: crypto.randomUUID(), title: `${source.title} Copy` }, source.body);
}

export async function reorderDocuments(root: string, orderedPaths: string[]): Promise<void> {
  if (!Array.isArray(orderedPaths) || orderedPaths.length === 0) throw new Error("At least one manuscript page is required");
  if (new Set(orderedPaths).size !== orderedPaths.length) throw new Error("Manuscript order contains duplicate pages");
  await Promise.all(orderedPaths.map(async (relativePath, index) => {
    const document = await readDocument(root, relativePath, "manuscript", "manuscript");
    const nextFrontmatter: Record<string, unknown> = { ...document.frontmatter, order: index + 1 };
    delete nextFrontmatter.chapter;
    delete nextFrontmatter.scene_number;
    await writeDocument(root, relativePath, nextFrontmatter, document.body);
  }));
}
