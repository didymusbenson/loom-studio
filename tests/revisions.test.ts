import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createBookmark, createTimeline, ensureRepository, revisionStatus, switchTimeline, timelineRef } from "../src/revisions.js";

async function projectCopy(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "loom-revisions-"));
  await fs.writeFile(path.join(root, "loom.json"), JSON.stringify({ loom_version: "1.0.0", name: "Test", type: "book", genre: "test" }));
  await fs.mkdir(path.join(root, "manuscript"));
  await fs.writeFile(path.join(root, "manuscript", "one.md"), "---\ntitle: One\n---\n\nStart.\n");
  return root;
}

test("initializes history, creates bookmarks, and maintains alternate timelines", async () => {
  const root = await projectCopy();
  await ensureRepository(root);
  await fs.appendFile(path.join(root, "manuscript", "one.md"), "More.\n");
  await createBookmark(root, "Expanded opening");
  assert.equal(await createTimeline(root, "Darker Ending"), "timeline/darker-ending");
  let status = await revisionStatus(root);
  assert.equal(status.timeline, "timeline/darker-ending");
  assert.ok(status.bookmarks.some(bookmark => bookmark.message === "Expanded opening"));
  await switchTimeline(root, "main");
  status = await revisionStatus(root);
  assert.equal(status.timeline, "main");
});

test("normalizes timeline names", () => assert.equal(timelineRef(" Romance Subplot "), "timeline/romance-subplot"));
