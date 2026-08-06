import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProject } from "../src/lifecycle.js";
import { archiveItem, listArchive, permanentlyDeleteTrashItem, restoreArchivedItem } from "../src/archive.js";
import { createDocument, readDocument, renameDocument, reorderDocuments, writeDocument } from "../src/documents.js";
import { indexProject } from "../src/project.js";
import { inspectManifest, migrateManifest, repairManifest } from "../src/migrations.js";

async function tempRoot(): Promise<string> { return fs.mkdtemp(path.join(os.tmpdir(), "loom-studio-m1-")); }

test("creates an external author-ready project", async () => {
  const parent = await tempRoot();
  const root = await createProject({ name: "Paper Moons", parent, genre: "fantasy" });
  const manifest = JSON.parse(await fs.readFile(path.join(root, "loom.json"), "utf8"));
  assert.equal(manifest.loom_version, "1.0.0");
  assert.equal(manifest.name, "Paper Moons");
  assert.ok(manifest.project_id);
  assert.ok((await fs.stat(path.join(root, ".git"))).isDirectory());
  assert.ok((await fs.stat(path.join(root, "manuscript", "chapter-001.md"))).isFile());
});

test("preserves stable ids and unknown metadata through edits and renames", async () => {
  const parent = await tempRoot();
  const root = await createProject({ name: "Identity Test", parent });
  const original = await readDocument(root, "manuscript/chapter-001.md", "manuscript", "manuscript");
  await writeDocument(root, original.path, { ...original.frontmatter, custom_field: "keep me" }, "Changed prose");
  await renameDocument(root, original.path, "manuscript/opening.md");
  const renamed = await readDocument(root, "manuscript/opening.md", "manuscript", "manuscript");
  assert.equal(renamed.id, original.id);
  assert.equal(renamed.frontmatter.custom_field, "keep me");
  assert.match(renamed.body, /Changed prose/);
});

test("persists authored manuscript order without changing stable ids", async () => {
  const parent = await tempRoot();
  const root = await createProject({ name: "Order Test", parent });
  await createDocument(root, "manuscript/chapter-002.md", { type: "chapter", title: "Second", order: 2 }, "Second page");
  const before = await indexProject(root);
  const firstId = before.graph.manuscripts[0]?.id;
  const secondId = before.graph.manuscripts[1]?.id;
  await reorderDocuments(root, ["manuscript/chapter-002.md", "manuscript/chapter-001.md"]);
  const after = await indexProject(root);
  assert.deepEqual(after.graph.manuscripts.map(item => item.path), ["manuscript/chapter-002.md", "manuscript/chapter-001.md"]);
  assert.equal(after.graph.manuscripts[0]?.id, secondId);
  assert.equal(after.graph.manuscripts[1]?.id, firstId);
});

test("archives and restores rather than deleting", async () => {
  const parent = await tempRoot();
  const root = await createProject({ name: "Archive Test", parent });
  const item = await archiveItem(root, "manuscript/chapter-001.md");
  assert.equal((await listArchive(root)).length, 1);
  await restoreArchivedItem(root, item.id);
  assert.ok((await fs.stat(path.join(root, "manuscript/chapter-001.md"))).isFile());
  await assert.rejects(() => permanentlyDeleteTrashItem(root, "anything", "no"), /DELETE FOREVER/);
});

test("repairs malformed manifests and writes a backup", async () => {
  const root = await tempRoot();
  await fs.writeFile(path.join(root, "loom.json"), "{broken", "utf8");
  assert.equal((await inspectManifest(root)).valid, false);
  const repaired = await repairManifest(root, { name: "Recovered Book" });
  assert.equal(repaired.name, "Recovered Book");
  assert.equal((await inspectManifest(root)).valid, true);
  assert.ok((await fs.readdir(root)).some(name => name.startsWith("loom.json.backup-")));
});

test("migrates old manifests to the current contract", async () => {
  const root = await tempRoot();
  await fs.writeFile(path.join(root, "loom.json"), JSON.stringify({ loom_version: "0.1", name: "Old Book" }), "utf8");
  const migrated = await migrateManifest(root);
  assert.equal(migrated.loom_version, "1.0.0");
  assert.equal(migrated.name, "Old Book");
});

test("reports duplicate ids and unresolved character references", async () => {
  const parent = await tempRoot();
  const root = await createProject({ name: "Diagnostics", parent });
  const first = await readDocument(root, "manuscript/chapter-001.md", "manuscript", "manuscript");
  await createDocument(root, "manuscript/chapter-002.md", { id: first.id, type: "chapter", title: "Two", characters_present: ["Missing Person"] }, "Second");
  const { graph } = await indexProject(root);
  assert.ok(graph.diagnostics.some(item => item.code === "duplicate-id"));
  assert.ok(graph.diagnostics.some(item => item.code === "missing-character"));
});

test("derives POV, location, appearance, relationship, tag, and broken-link graph data", async () => {
  const parent = await tempRoot();
  const root = await createProject({ name: "Graph Test", parent });
  await createDocument(root, "characters/mara.md", { id: "char-mara", type: "character", title: "Mara", name: "Mara", tags: ["crew"] }, "Mara");
  await createDocument(root, "world/harbor.md", { id: "loc-harbor", type: "location", title: "Harbor", name: "Harbor" }, "Harbor");
  await createDocument(root, "relationships/mara-harbor.md", { id: "rel-1", type: "relationship", title: "Mara and Harbor", from: "Mara", to: "Harbor" }, "Connection");
  await createDocument(root, "relationships/broken.md", { id: "rel-2", type: "relationship", title: "Broken", from: "Mara", to: "Nobody" }, "Broken");
  const first = await readDocument(root, "manuscript/chapter-001.md", "manuscript", "manuscript");
  await writeDocument(root, first.path, { ...first.frontmatter, pov: "Mara", location: "Harbor", characters_present: ["Mara"], tags: ["opening"] }, first.body);
  const { graph } = await indexProject(root);
  assert.ok(graph.links.some(link => link.type === "pov" && link.to === "char-mara"));
  assert.ok(graph.links.some(link => link.type === "located-at" && link.to === "loc-harbor"));
  assert.ok(graph.links.some(link => link.type === "features" && link.to === "char-mara"));
  assert.ok(graph.links.some(link => link.type === "relationship-from" && link.from === "rel-1"));
  assert.ok(graph.links.some(link => link.type === "relationship-to" && link.from === "rel-1"));
  assert.ok(graph.tags.some(tag => tag.name === "opening"));
  assert.ok(graph.diagnostics.some(item => item.code === "broken-link"));
});
