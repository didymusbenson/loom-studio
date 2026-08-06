import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { DocumentKind, LoomDocument } from "./model.js";

const titleFromPath = (filePath: string) => path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export async function readDocument(root: string, relativePath: string, kind: DocumentKind, category: string): Promise<LoomDocument> {
  const absolute = path.join(root, relativePath);
  const [raw, stat] = await Promise.all([fs.readFile(absolute, "utf8"), fs.stat(absolute)]);
  const parsed = matter(raw);
  const warnings: string[] = [];
  const orderValue = parsed.data.scene_number ?? parsed.data.chapter ?? parsed.data.order ?? Number.MAX_SAFE_INTEGER;
  const order = Number(orderValue);
  if (!Number.isFinite(order)) warnings.push("Invalid document order metadata");
  return {
    id: relativePath,
    path: relativePath,
    kind,
    category,
    title: String(parsed.data.title ?? titleFromPath(relativePath)),
    order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
    frontmatter: parsed.data,
    body: parsed.content.replace(/^\n/, ""),
    raw,
    modifiedAt: stat.mtime.toISOString(),
    warnings,
  };
}

export async function writeDocument(root: string, relativePath: string, frontmatter: Record<string, unknown>, body: string): Promise<void> {
  const absolute = path.resolve(root, relativePath);
  const safeRoot = path.resolve(root) + path.sep;
  if (!absolute.startsWith(safeRoot)) throw new Error("Document path escapes project root");
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const output = matter.stringify(body.endsWith("\n") ? body : `${body}\n`, frontmatter);
  const temporary = `${absolute}.loom-studio-tmp`;
  await fs.writeFile(temporary, output, "utf8");
  await fs.rename(temporary, absolute);
}
