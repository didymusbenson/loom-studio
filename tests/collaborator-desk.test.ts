import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("collapsed Collaborator Desk is hidden from interaction and reserves its gutter", async () => {
  const [js, css] = await Promise.all([
    fs.readFile("public/milestone2.js", "utf8"),
    fs.readFile("public/milestone2.css", "utf8"),
  ]);

  assert.match(js, /aria-hidden/);
  assert.match(js, /deskBody\.inert = !open/);
  assert.match(css, /body>main\{margin-right:42px/);
  assert.match(css, /body\.assistant-desk-open>main\{margin-right:clamp/);
  assert.match(css, /\.assistant-desk\.collapsed \.assistant-desk-body\{visibility:hidden;pointer-events:none\}/);
});

test("narrow Collaborator Desk behaves like a dismissible modal drawer", async () => {
  const [js, css] = await Promise.all([
    fs.readFile("public/milestone2.js", "utf8"),
    fs.readFile("public/milestone2.css", "utf8"),
  ]);

  assert.match(js, /aria-modal/);
  assert.match(js, /setWorkspaceInert\(modal\)/);
  assert.match(js, /event\.key === "Escape"/);
  assert.match(js, /event\.key !== "Tab"/);
  assert.match(js, /returnFocus: true/);
  assert.match(js, /deskBackdrop\.onclick/);
  assert.match(css, /\.assistant-desk-backdrop/);
  assert.match(css, /@media\(max-width:760px\)/);
});
