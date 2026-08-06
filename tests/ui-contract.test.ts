import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = (file: string) => fs.readFile(file, "utf8");

test("loads the author-ready workflow and tactile binder styles", async () => {
  const html = await read("public/index.html");
  assert.match(html, /milestone1\.css/);
  assert.match(html, /milestone1\.js/);
  assert.match(html, /Project Binder Shelf/);
  assert.match(html, /Story Pages/);
});

test("normal author interface does not expose source-control jargon", async () => {
  const html = (await read("public/index.html")).toLowerCase();
  for (const forbidden of ["git branch", "commit hash", "checkout", "detached head", "merge conflict"]) {
    assert.equal(html.includes(forbidden), false, `UI leaked developer phrase: ${forbidden}`);
  }
  assert.match(html, /bookmark/);
  assert.match(html, /timeline/);
});

test("milestone workflows include reorder, archive, trash, and timeline management", async () => {
  const script = await read("public/milestone1.js");
  assert.match(script, /\/api\/documents\/reorder/);
  assert.match(script, /DELETE FOREVER/);
  assert.match(script, /\/api\/revisions\/timelines\/rename/);
  assert.match(script, /Archive & Trash/);
});
