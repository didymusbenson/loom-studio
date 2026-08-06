import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { DocumentTypeSchema, type DocumentKind, type LoomDocument } from "./model.js";

const titleFromPath = (filePath: string) => path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const words = (text: string) => (text.trim().match(/\b[\p{L}\p{N}’'-]+\b/gu) ?? []).length;

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
