import { z } from "zod";

export const CURRENT_LOOM_VERSION = "1.0.0";

export const LoomManifestSchema = z.object({
  loom_version: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(["book", "session"]).default("book"),
  genre: z.string().default("unspecified"),
  created: z.string().optional(),
  manuscript: z.object({
    roots: z.array(z.string()).default(["manuscript", "SCENES"]),
    order: z.array(z.string()).default([]),
  }).default({ roots: ["manuscript", "SCENES"], order: [] }),
  references: z.record(z.string(), z.array(z.string())).default({
    characters: ["characters", "CHARACTERS"],
    world: ["world"],
    relationships: ["relationships"],
    observations: ["observations"],
    notes: ["notes"],
    project: ["*.md"],
  }),
  archive: z.object({
    root: z.string().default(".loom/archive"),
    trash: z.string().default(".loom/trash"),
  }).default({ root: ".loom/archive", trash: ".loom/trash" }),
  ui: z.object({
    default_reference_category: z.string().optional(),
  }).default({}),
}).passthrough();

export type LoomManifest = z.infer<typeof LoomManifestSchema>;

export const DocumentTypeSchema = z.enum([
  "chapter", "scene", "character", "location", "relationship",
  "observation", "world", "note", "project", "unknown"
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type DocumentKind = "manuscript" | "reference";

export interface LoomDocument {
  id: string;
  path: string;
  kind: DocumentKind;
  type: DocumentType;
  category: string;
  title: string;
  order: number;
  status: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string;
  wordCount: number;
  modifiedAt: string;
  warnings: string[];
}

export interface ProjectDiagnostic {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  path?: string;
  documentId?: string;
}

export type ProjectLinkType =
  | "features"
  | "pov"
  | "located-at"
  | "references"
  | "relationship"
  | "relationship-from"
  | "relationship-to";

export interface ProjectGraph {
  documents: LoomDocument[];
  manuscripts: LoomDocument[];
  references: Record<string, LoomDocument[]>;
  characters: Array<{ id: string; name: string; path: string }>;
  locations: Array<{ id: string; name: string; path: string }>;
  tags: Array<{ name: string; documentIds: string[] }>;
  links: Array<{ from: string; to: string; type: ProjectLinkType }>;
  diagnostics: ProjectDiagnostic[];
  generatedAt: string;
}

export interface ProjectSnapshot {
  root: string;
  manifest: LoomManifest;
  graph: ProjectGraph;
  revision: RevisionStatus;
}

export interface RevisionStatus {
  initialized: boolean;
  timeline: string | null;
  dirty: boolean;
  bookmarks: Array<{ id: string; message: string; date: string }>;
  timelines: string[];
}

export interface AdapterCapabilities {
  liveActivity: boolean;
  pendingWriteReview: boolean;
  turnBoundaries: boolean;
  agentIdentity: boolean;
  tokenUsage: boolean;
  canConfigureProject: boolean;
}

export interface SessionAdapter {
  id: string;
  displayName: string;
  capabilities: AdapterCapabilities;
  detect(projectRoot: string): Promise<boolean>;
}
