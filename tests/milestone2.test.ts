import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProject } from "../src/lifecycle.js";
import { GenericFilesystemAdapter, appendAssistantEvent, ensureSession } from "../src/assistants.js";
import { ClaudeCodePack, GenericFilesystemPack } from "../src/engine-packs.js";
import { compileRuntime } from "../src/runtime.js";

const temporaryParent = () => fs.mkdtemp(path.join(os.tmpdir(), "loom-studio-m2-"));

test("compiles deterministic disposable runtime capsules", async () => {
  const parent = await temporaryParent();
  const root = await createProject({ name: "Runtime Book", parent, genre: "mystery" });
  const manuscriptBefore = await fs.readFile(path.join(root, "manuscript", "chapter-001.md"), "utf8");
  const first = await compileRuntime(root);
  const contextBefore = await fs.readFile(path.join(root, ".loom", "runtime", "runtime-context.md"), "utf8");
  const second = await compileRuntime(root);
  const contextAfter = await fs.readFile(path.join(root, ".loom", "runtime", "runtime-context.md"), "utf8");
  assert.deepEqual(first, second);
  assert.equal(contextBefore, contextAfter);
  assert.equal(await fs.readFile(path.join(root, "manuscript", "chapter-001.md"), "utf8"), manuscriptBefore);
});

test("installs provider-neutral and Claude Code engine packs without credentials", async () => {
  const parent = await temporaryParent();
  const root = await createProject({ name: "Engine Book", parent });
  const generic = await new GenericFilesystemPack().install(root);
  assert.equal(generic.id, "generic-filesystem");
  assert.match(await fs.readFile(path.join(root, ".loom", "engines", "generic-filesystem", "INSTRUCTIONS.md"), "utf8"), /prompting remains/i);
  const claude = await new ClaudeCodePack().install(root);
  assert.equal(claude.id, "claude-code");
  const claudeInstructions = await fs.readFile(path.join(root, "CLAUDE.md"), "utf8");
  assert.match(claudeInstructions, /Do not request or store Anthropic API credentials/);
  assert.equal(claudeInstructions.includes("api_key"), false);
});

test("observes external filesystem sessions without owning prompts", async () => {
  const parent = await temporaryParent();
  const root = await createProject({ name: "Observed Book", parent });
  const session = await ensureSession(root, { adapterId: "generic-filesystem", displayName: "External CLI", status: "active" });
  await appendAssistantEvent(root, { sessionId: session.id, type: "task", summary: "Review chapter pacing" });
  await appendAssistantEvent(root, { sessionId: session.id, type: "read", summary: "Read opening chapter", path: "manuscript/chapter-001.md" });
  const adapter = new GenericFilesystemAdapter();
  assert.equal(await adapter.detect(root), true);
  assert.equal((await adapter.listSessions(root))[0]?.id, session.id);
  const events = await adapter.readEvents(root, session.id);
  assert.deepEqual(events.map(event => event.type), ["task", "read"]);
});
