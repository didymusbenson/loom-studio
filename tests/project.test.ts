import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { indexProject } from "../src/project.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, "../fixtures/sample-project");

test("indexes ordered manuscripts, references, characters, and graph links", async () => {
  const { manifest, graph } = await indexProject(fixture);
  assert.equal(manifest.name, "The Lantern Archive");
  assert.deepEqual(graph.manuscripts.map(document => document.title), ["The Door Under the Rain", "What the Archive Forgot"]);
  assert.equal(graph.characters.length, 2);
  assert.ok(graph.references.world?.some(document => document.title === "The Lantern Archive"));
  assert.ok(graph.links.some(link => link.type === "features" && link.from.endsWith("chapter-001.md")));
});
