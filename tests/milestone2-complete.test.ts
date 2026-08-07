import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProject } from "../src/lifecycle.js";
import { GenericFilesystemAdapter, appendAssistantEvent, ensureSession } from "../src/assistants.js";
import { builtinEnginePacks, getEnginePack } from "../src/engine-packs.js";
import { compileRuntime } from "../src/runtime.js";
import { acceptProposal, createProposal, editProposal, inspectProposal, listProposals, rejectProposal } from "../src/proposals.js";
import { readDocument, writeDocument } from "../src/documents.js";

async function project(name = "M2 Test") { const parent = await fs.mkdtemp(path.join(os.tmpdir(), "loom-m2-")); return createProject({ name, parent }); }
async function canonicalHash(root: string): Promise<string> { const files = ["loom.json", "manuscript/chapter-001.md"]; return (await Promise.all(files.map(file => fs.readFile(path.join(root, file), "utf8")))).join("\n---\n"); }

test("engine packs are versioned and preserve canonical author documents", async () => {
  const root = await project(); const before = await canonicalHash(root);
  for (const pack of builtinEnginePacks) { assert.ok(pack.id); assert.ok(pack.version); const installed = await pack.install(root); assert.equal(installed.id, pack.id); assert.equal(await pack.detect(root), true); assert.ok(await pack.inspect(root)); await pack.compile(root); await pack.upgrade(root); await pack.remove(root); assert.equal(await pack.detect(root), false); }
  assert.equal(await canonicalHash(root), before);
});

test("runtime capsules regenerate deterministically without becoming project truth", async () => {
  const root = await project(); const before = await canonicalHash(root); const first = await compileRuntime(root); const firstContent = await fs.readFile(path.join(root, ".loom/runtime/project-capsule.md"), "utf8"); await fs.rm(path.join(root, ".loom/runtime"), { recursive: true, force: true }); const second = await compileRuntime(root); const secondContent = await fs.readFile(path.join(root, ".loom/runtime/project-capsule.md"), "utf8"); assert.deepEqual(second, first); assert.equal(secondContent, firstContent); assert.equal(await canonicalHash(root), before);
});

test("generic adapter persists sessions and normalizes external activity", async () => {
  const root = await project(); const session = await ensureSession(root, { adapterId: "generic-filesystem", displayName: "External Helper", status: "active" });
  for (const type of ["status", "read", "write", "task", "waiting", "completed", "error"] as const) await appendAssistantEvent(root, { sessionId: session.id, type, summary: type });
  await fs.appendFile(path.join(root, ".loom/sessions", session.id, "events.jsonl"), "not-json\n", "utf8"); const adapter = new GenericFilesystemAdapter(); assert.equal(await adapter.detect(root), true); assert.equal((await adapter.listSessions(root))[0]?.id, session.id); const events = await adapter.readEvents(root, session.id); assert.equal(events.length, 7); assert.deepEqual(events.map(event => event.type), ["status", "read", "write", "task", "waiting", "completed", "error"]);
});

test("proposal bundles do not touch canonical files before acceptance", async () => {
  const root = await project(); const original = await readDocument(root, "manuscript/chapter-001.md", "manuscript", "manuscript"); const proposal = await createProposal(root, { title: "A revision", summary: "Improve opening", files: [{ path: original.path, baseModifiedAt: original.modifiedAt, frontmatter: original.frontmatter, body: "Proposed prose" }] });
  assert.equal((await readDocument(root, original.path, "manuscript", "manuscript")).body, original.body); assert.equal((await listProposals(root))[0]?.status, "pending"); await editProposal(root, proposal.id, [{ ...proposal.files[0]!, body: "Edited proposal prose" }]); await acceptProposal(root, proposal.id, { bookmark: "Accepted proposed revision" }); assert.match((await readDocument(root, original.path, "manuscript", "manuscript")).body, /Edited proposal prose/);
});

test("stale proposals require explicit conflict handling and rejection is persistent", async () => {
  const root = await project(); const original = await readDocument(root, "manuscript/chapter-001.md", "manuscript", "manuscript"); const stale = await createProposal(root, { title: "Stale", summary: "Old base", files: [{ path: original.path, baseModifiedAt: original.modifiedAt, frontmatter: original.frontmatter, body: "Old proposal" }] }); await new Promise(resolve => setTimeout(resolve, 20)); await writeDocument(root, original.path, original.frontmatter, "Newer author work"); assert.equal((await inspectProposal(root, stale.id)).status, "stale"); await assert.rejects(() => acceptProposal(root, stale.id), /stale/); await acceptProposal(root, stale.id, { allowStale: true }); const rejected = await createProposal(root, { title: "Reject", summary: "No", files: [{ path: original.path, frontmatter: original.frontmatter, body: "No" }] }); assert.equal((await rejectProposal(root, rejected.id)).status, "rejected");
});

test("assistant desk remains observational and secondary", async () => {
  const [html, js, css, routes] = await Promise.all([fs.readFile("public/index.html", "utf8"), fs.readFile("public/milestone2.js", "utf8"), fs.readFile("public/milestone2.css", "utf8"), fs.readFile("src/milestone2-routes.ts", "utf8")]); assert.match(html, /milestone2\.js/); assert.match(js, /Collaborator Desk/); assert.match(js, /Keep prompting/); assert.match(css, /collapsed/); assert.match(routes, /assistants\/sessions/); for (const forbidden of ["anthropic api key", "openai api key", "provider login", "embedded chat"]) assert.equal((html + js + routes).toLowerCase().includes(forbidden), false); assert.equal(getEnginePack("claude-code").id, "claude-code");
});
