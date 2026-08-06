import { z } from "zod";

export const LoomManifestSchema = z.object({
  loom_version: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["book", "session"]).default("book"),
  genre: z.string().default("unspecified"),
  manuscript: z.object({
    roots: z.array(z.string()).default(["manuscript", "SCENES"]),
  }).default({ roots: ["manuscript", "SCENES"] }),
  references: z.record(z.string(), z.array(z.string())).default({
    characters: ["characters", "CHARACTERS"],
    world: ["world"],
    project: ["*.md"],
  }),
  ui: z.object({
    default_reference_category: z.string().optional(),
  }).default({}),
});

export type LoomManifest = z.infer<typeof LoomManifestSchema>;

export type DocumentKind = "manuscript" | "reference";

export interface LoomDocument {
  id: string;
  path: string;
  kind: DocumentKind;
  category: string;
  title: string;
  order: number;
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string;
  modifiedAt: string;
  warnings: string[];
}

export interface ProjectGraph {
  documents: LoomDocument[];
  manuscripts: LoomDocument[];
  references: Record<string, LoomDocument[]>;
  characters: Array<{ id: string; name: string; path: string }>;
  links: Array<{ from: string; to: string; type: string }>;
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
