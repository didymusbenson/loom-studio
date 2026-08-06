import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { CURRENT_LOOM_VERSION, LoomManifestSchema, type LoomManifest } from "./model.js";

export interface ManifestInspection {
  valid: boolean;
  current: boolean;
  version: string | null;
  errors: string[];
  repairable: boolean;
}

const manifestFile = (root: string) => path.join(path.resolve(root), "loom.json");

export async function inspectManifest(root: string): Promise<ManifestInspection> {
  let raw: string;
  try { raw = await fs.readFile(manifestFile(root), "utf8"); } catch { return { valid: false, current: false, version: null, errors: ["loom.json is missing"], repairable: true }; }
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { valid: false, current: false, version: null, errors: ["loom.json is not valid JSON"], repairable: true }; }
  const result = LoomManifestSchema.safeParse(value);
  const version = typeof value === "object" && value && "loom_version" in value ? String((value as Record<string, unknown>).loom_version) : null;
  return result.success
    ? { valid: true, current: result.data.loom_version === CURRENT_LOOM_VERSION, version: result.data.loom_version, errors: [], repairable: true }
    : { valid: false, current: false, version, errors: result.error.issues.map(issue => `${issue.path.join(".") || "manifest"}: ${issue.message}`), repairable: true };
}

async function backup(root: string): Promise<void> {
  const file = manifestFile(root);
  try { await fs.copyFile(file, path.join(root, `loom.json.backup-${new Date().toISOString().replaceAll(":", "-")}`)); } catch { /* missing manifest */ }
}

function defaultManifest(name: string): LoomManifest {
  return LoomManifestSchema.parse({
    loom_version: CURRENT_LOOM_VERSION,
    project_id: crypto.randomUUID(),
    name,
    type: "book",
    genre: "unspecified",
    created: new Date().toISOString(),
    manuscript: { roots: ["manuscript", "SCENES"], order: [] },
    references: { characters: ["characters", "CHARACTERS"], world: ["world"], relationships: ["relationships"], observations: ["observations"], notes: ["notes"], project: ["*.md"] },
    archive: { root: ".loom/archive", trash: ".loom/trash" },
    ui: { default_reference_category: "characters" }
  });
}

export async function migrateManifest(root: string): Promise<LoomManifest> {
  await backup(root);
  const file = manifestFile(root);
  let old: Record<string, unknown> = {};
  try { old = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>; } catch { /* repair from disk */ }
  const repaired = defaultManifest(typeof old.name === "string" && old.name.trim() ? old.name : path.basename(path.resolve(root)));
  const merged = LoomManifestSchema.parse({ ...repaired, ...old, loom_version: CURRENT_LOOM_VERSION, project_id: typeof old.project_id === "string" ? old.project_id : repaired.project_id });
  await fs.writeFile(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

export async function repairManifest(root: string, patch: Partial<LoomManifest> = {}): Promise<LoomManifest> {
  await backup(root);
  const repaired = LoomManifestSchema.parse({ ...defaultManifest(patch.name ?? path.basename(path.resolve(root))), ...patch, loom_version: CURRENT_LOOM_VERSION });
  await fs.writeFile(manifestFile(root), `${JSON.stringify(repaired, null, 2)}\n`, "utf8");
  return repaired;
}
