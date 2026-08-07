import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createReferenceDocument, readDocument, renameReferenceDocument, writeDocument } from "../src/documents.js";
import { createProject } from "../src/lifecycle.js";
import { indexProject } from "../src/project.js";

test("round-trips body and frontmatter through an atomic save", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "loom-doc-"));
  await writeDocument(root, "manuscript/one.md", { title: "One", scene_number: 1 }, "Opening line.");
  const document = await readDocument(root, "manuscript/one.md", "manuscript", "manuscript");
  assert.equal(document.title, "One");
  assert.equal(document.order, 1);
  assert.equal(document.body.trim(), "Opening line.");
  await assert.rejects(() => writeDocument(root, "../escape.md", {}, "no"), /escapes project root/);
});

test("creates typed reference documents in configured project roots", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "loom-reference-"));
  const root = await createProject({ name: "Reference Test", parent });
  const created = await createReferenceDocument(root, { category: "characters", type: "character", title: "Mara Vale" });
  assert.equal(created.path, "characters/mara-vale.md");
  const document = await readDocument(root, created.path, "reference", "characters");
  assert.equal(document.id, created.id);
  assert.equal(document.frontmatter.name, "Mara Vale");
  assert.equal(document.type, "character");
  await assert.rejects(() => createReferenceDocument(root, { category: "characters", type: "character", title: "Mara Vale" }), /already exists/);
  await assert.rejects(() => createReferenceDocument(root, { category: "missing", type: "note", title: "Nope" }), /not configured/);
});

test("renames a reference visibly while preserving identity and repairing legacy references", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "loom-reference-rename-"));
  const root = await createProject({ name: "Rename Test", parent });
  const created = await createReferenceDocument(root, { category: "characters", type: "character", title: "Charles Reed" });
  const manuscript = await readDocument(root, "manuscript/chapter-001.md", "manuscript", "manuscript");
  await writeDocument(root, manuscript.path, { ...manuscript.frontmatter, characters_present: ["Charles Reed"], pov: "Charles Reed", custom_field: "preserve" }, manuscript.body);

  const preview = await renameReferenceDocument(root, created.path, "Charles Chisholm", true);
  assert.equal(preview.to, "characters/charles-chisholm.md");
  assert.ok(preview.affectedPaths.includes("manuscript/chapter-001.md"));
  assert.ok(await fs.stat(path.join(root, created.path)));

  const result = await renameReferenceDocument(root, created.path, "Charles Chisholm");
  const renamed = await readDocument(root, result.to, "reference", "characters");
  assert.equal(renamed.id, created.id);
  assert.equal(renamed.title, "Charles Chisholm");
  assert.equal(renamed.frontmatter.name, "Charles Chisholm");
  const updated = await readDocument(root, manuscript.path, "manuscript", "manuscript");
  assert.deepEqual(updated.frontmatter.characters_present, [created.id]);
  assert.equal(updated.frontmatter.pov, created.id);
  assert.equal(updated.frontmatter.custom_field, "preserve");
  const graph = (await indexProject(root)).graph;
  assert.ok(graph.links.some(link => link.type === "features" && link.to === created.id));
  await assert.rejects(() => fs.stat(path.join(root, created.path)), /ENOENT/);
});

test("reference rename rejects destination collisions without changing source", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "loom-reference-collision-"));
  const root = await createProject({ name: "Collision Test", parent });
  const first = await createReferenceDocument(root, { category: "characters", type: "character", title: "First Name" });
  await createReferenceDocument(root, { category: "characters", type: "character", title: "Taken Name" });
  await assert.rejects(() => renameReferenceDocument(root, first.path, "Taken Name"), /already exists/);
  const unchanged = await readDocument(root, first.path, "reference", "characters");
  assert.equal(unchanged.title, "First Name");
});
