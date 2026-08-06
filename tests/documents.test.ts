import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readDocument, writeDocument } from "../src/documents.js";

test("round-trips body and frontmatter through an atomic save", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "loom-doc-"));
  await writeDocument(root, "manuscript/one.md", { title: "One", scene_number: 1 }, "Opening line.");
  const document = await readDocument(root, "manuscript/one.md", "manuscript", "manuscript");
  assert.equal(document.title, "One");
  assert.equal(document.order, 1);
  assert.equal(document.body.trim(), "Opening line.");
  await assert.rejects(() => writeDocument(root, "../escape.md", {}, "no"), /escapes project root/);
});
