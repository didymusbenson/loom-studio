import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = (file: string) => fs.readFile(file, "utf8");

test("loads the author-ready workflow and tactile binder styles", async () => {
  const html = await read("public/index.html");
  assert.match(html, /milestone1\.css/);
  assert.match(html, /Project Binder Shelf/);
  assert.match(html, /Story Pages/);
  assert.match(html, /Archive & Trash/);
  assert.match(html, /Timeline options/);
});

test("normal author interface does not expose source-control jargon", async () => {
  const html = (await read("public/index.html")).toLowerCase();
  for (const forbidden of ["git branch", "commit hash", "checkout", "detached head", "merge conflict"]) {
    assert.equal(html.includes(forbidden), false, `UI leaked developer phrase: ${forbidden}`);
  }
  assert.match(html, /bookmark/);
  assert.match(html, /timeline/);
});

test("author-ready workflows include lifecycle, recovery, reorder, archive, trash, and timelines", async () => {
  const script = await read("public/app.js");
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /\/api\/manifest\/repair/);
  assert.match(script, /\/api\/documents\/reorder/);
  assert.match(script, /DELETE FOREVER/);
  assert.match(script, /\/api\/revisions\/timelines\/rename/);
  assert.match(script, /Archive & Trash/);
  assert.match(script, /beforeunload/);
  assert.match(script, /external change held/);
});
