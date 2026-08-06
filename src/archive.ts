import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function safe(root: string, relative: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relative);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Path escapes project root");
  return resolved;
}

async function exists(file: string): Promise<boolean> { try { await fs.access(file); return true; } catch { return false; } }

export interface ArchivedItem { id: string; originalPath: string; archivedPath: string; archivedAt: string; }

export async function archiveItem(root: string, relative: string): Promise<ArchivedItem> {
  const source = safe(root, relative);
  if (!(await exists(source))) throw new Error(`Document not found: ${relative}`);
  const id = crypto.randomUUID();
  const destinationRelative = path.posix.join(".loom/archive", id, relative.replaceAll("\\", "/"));
  const destination = safe(root, destinationRelative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);
  const record = { id, originalPath: relative.replaceAll("\\", "/"), archivedPath: destinationRelative, archivedAt: new Date().toISOString() };
  await fs.writeFile(safe(root, path.posix.join(".loom/archive", id, "archive.json")), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

async function listRecords(root: string, folder: ".loom/archive" | ".loom/trash"): Promise<ArchivedItem[]> {
  const base = safe(root, folder);
  let entries;
  try { entries = await fs.readdir(base, { withFileTypes: true }); } catch { return []; }
  const items: ArchivedItem[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try { items.push(JSON.parse(await fs.readFile(path.join(base, entry.name, "archive.json"), "utf8")) as ArchivedItem); } catch { /* tolerate incomplete item */ }
  }
  return items.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

export const listArchive = (root: string) => listRecords(root, ".loom/archive");
export const listTrash = (root: string) => listRecords(root, ".loom/trash");

export async function restoreArchivedItem(root: string, id: string): Promise<void> {
  const recordFile = safe(root, path.posix.join(".loom/archive", id, "archive.json"));
  const record = JSON.parse(await fs.readFile(recordFile, "utf8")) as ArchivedItem;
  const source = safe(root, record.archivedPath);
  const destination = safe(root, record.originalPath);
  if (await exists(destination)) throw new Error(`Cannot restore because ${record.originalPath} already exists`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);
  await fs.rm(safe(root, path.posix.join(".loom/archive", id)), { recursive: true, force: true });
}

export async function moveArchiveToTrash(root: string, id: string): Promise<void> {
  const source = safe(root, path.posix.join(".loom/archive", id));
  const destination = safe(root, path.posix.join(".loom/trash", id));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);
  const recordFile = path.join(destination, "archive.json");
  const record = JSON.parse(await fs.readFile(recordFile, "utf8")) as ArchivedItem;
  record.archivedPath = path.posix.join(".loom/trash", id, record.originalPath);
  await fs.writeFile(recordFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function permanentlyDeleteTrashItem(root: string, id: string, confirmation: string): Promise<void> {
  if (confirmation !== "DELETE FOREVER") throw new Error('Type "DELETE FOREVER" to permanently delete this item');
  await fs.rm(safe(root, path.posix.join(".loom/trash", id)), { recursive: true, force: true });
}
