import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { indexProject } from "./project.js";

const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

async function writeIfChanged(file: string, content: string): Promise<void> {
  let current = "";
  try { current = await fs.readFile(file, "utf8"); } catch { /* create below */ }
  if (current === content) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim() || "_(none)_"}\n`;
}

export async function compileRuntime(projectRoot: string, engineId = "generic-filesystem"): Promise<string[]> {
  const { manifest, graph } = await indexProject(projectRoot);
  const runtimeRoot = path.join(projectRoot, ".loom", "runtime");
  const cast = graph.characters
    .map(character => `- ${character.name} (${character.id}) — ${character.path}`)
    .join("\n");
  const locations = graph.locations
    .map(location => `- ${location.name} (${location.id}) — ${location.path}`)
    .join("\n");
  const manuscript = graph.manuscripts
    .map((document, index) => `${index + 1}. ${document.title} [${document.status}] — ${document.path} (${document.wordCount} words)`)
    .join("\n");
  const tags = graph.tags.map(tag => `- ${tag.name}: ${tag.documentIds.join(", ")}`).join("\n");
  const diagnostics = graph.diagnostics.map(item => `- ${item.severity.toUpperCase()}: ${item.message}${item.path ? ` — ${item.path}` : ""}`).join("\n");

  const capsules: Record<string, string> = {
    "project-capsule.md": `# ${manifest.name}\n\n- Project ID: ${manifest.project_id ?? "unassigned"}\n- Type: ${manifest.type}\n- Genre: ${manifest.genre}\n- Loom version: ${manifest.loom_version}\n- Engine: ${engineId}\n`,
    "cast-capsule.md": `# Cast Capsule\n\n${cast || "No character sheets are indexed."}\n`,
    "world-capsule.md": `# World Capsule\n\n${section("Locations", locations)}${section("Tags", tags)}`,
    "manuscript-capsule.md": `# Manuscript Capsule\n\n${manuscript || "No manuscript pages are indexed."}\n`,
    "health-capsule.md": `# Project Health\n\n${diagnostics || "No project-health issues are currently indexed."}\n`,
  };

  const orderedNames = Object.keys(capsules).sort();
  const context = [
    `# Loom Runtime Context`,
    ``,
    `Generated from canonical project files. These files are disposable runtime artifacts and must not be treated as project truth.`,
    ``,
    ...orderedNames.map(name => `- [${name}](./${name})`),
    ``,
  ].join("\n");
  capsules["runtime-context.md"] = context;

  const generated: string[] = [];
  for (const name of Object.keys(capsules).sort()) {
    const content = capsules[name].endsWith("\n") ? capsules[name] : `${capsules[name]}\n`;
    await writeIfChanged(path.join(runtimeRoot, name), content);
    generated.push(path.posix.join(".loom/runtime", name));
  }
  const manifestFile = {
    generatedAt: new Date().toISOString(),
    engineId,
    sourceFingerprint: hash(JSON.stringify({ manifest, documents: graph.documents.map(document => ({ id: document.id, path: document.path, modifiedAt: document.modifiedAt })) })),
    files: generated,
  };
  await fs.writeFile(path.join(runtimeRoot, "runtime.json"), `${JSON.stringify(manifestFile, null, 2)}\n`, "utf8");
  generated.push(".loom/runtime/runtime.json");
  return generated;
}
