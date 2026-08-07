import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = (file: string) => fs.readFile(file, "utf8");

test("loads the author-ready workflow and tactile binder styles", async () => {
  const html = await read("public/index.html");
  const script = await read("public/app.js");
  assert.match(html, /milestone1\.css/);
  assert.match(html, /Project Binder Shelf/);
  assert.match(html, /Story Pages/);
  assert.match(html, /id="rename-document"/);
  assert.match(script, /Archive & Trash/);
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

test("reference sheets provide safe reading, creation, selection, and coherent rename controls", async () => {
  const html = await read("public/index.html");
  const script = await read("public/app.js");
  assert.match(html, /id="reference-preview"/);
  assert.match(html, /id="new-reference"/);
  assert.match(html, /id="rename-reference-dialog"/);
  assert.match(html, /id="entity-dialog"/);
  assert.match(script, /renderMarkdown/);
  assert.match(script, /entityPillsMarkup/);
  assert.match(script, /openEntityChooser/);
  assert.match(script, /class="entity-add"/);
  assert.match(script, /\/api\/references\/rename/);
  assert.match(script, /dryRun:true/);
  assert.match(script, /Use Rename to keep the name and filename together/);
});

test("writer-facing versions and recent projects use clear action language", async () => {
  const html = await read("public/index.html");
  const script = await read("public/app.js");
  assert.match(html, />Save version</);
  assert.match(html, />Saved versions</);
  assert.match(html, /Creates a named bookmark you can return to later/);
  assert.match(script, /Remove from recents/);
  assert.match(script, /files will stay on disk/);
});
