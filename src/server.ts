import path from "node:path";
import http from "node:http";
import express from "express";
import chokidar from "chokidar";
import { WebSocketServer } from "ws";
import { indexProject } from "./project.js";
import { createDocument, duplicateDocument, renameDocument, writeDocument } from "./documents.js";
import { archiveItem, listArchive, moveArchiveToTrash, permanentlyDeleteTrashItem, restoreArchivedItem } from "./archive.js";
import { createProject, forgetProject, listRecentProjects, rememberProject } from "./lifecycle.js";
import { inspectManifest, migrateManifest, repairManifest } from "./migrations.js";
import { bookmarkAndSwitch, createBookmark, createTimeline, deleteTimeline, ensureRepository, renameTimeline, restoreBookmark, revisionStatus, switchTimeline } from "./revisions.js";

const app = express();
const server = http.createServer(app);
const sockets = new WebSocketServer({ server, path: "/events" });
const port = Number(process.env.PORT ?? 4173);
let projectRoot = process.env.LOOM_PROJECT ? path.resolve(process.env.LOOM_PROJECT) : path.resolve("fixtures/sample-project");
let watcher: chokidar.FSWatcher | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.resolve("public")));

async function snapshot() {
  const indexed = await indexProject(projectRoot);
  return { root: projectRoot, ...indexed, revision: await revisionStatus(projectRoot), archive: await listArchive(projectRoot), manifestInspection: await inspectManifest(projectRoot) };
}

function broadcast(type: string) {
  const payload = JSON.stringify({ type, at: new Date().toISOString() });
  for (const client of sockets.clients) if (client.readyState === client.OPEN) client.send(payload);
}

async function watchProject() {
  await watcher?.close();
  watcher = chokidar.watch(projectRoot, { ignored: [/(^|[/\\])\../, /node_modules/, /\.git/], ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 180, pollInterval: 50 } });
  watcher.on("all", () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => broadcast("project-changed"), 220);
  });
}

app.get("/api/library", async (_req, res, next) => { try { res.json({ recent: await listRecentProjects() }); } catch (error) { next(error); } });
app.delete("/api/library/recent", async (req, res, next) => { try { await forgetProject(String(req.body.path ?? "")); res.json({ recent: await listRecentProjects() }); } catch (error) { next(error); } });
app.post("/api/projects", async (req, res, next) => {
  try { projectRoot = await createProject(req.body); await watchProject(); res.status(201).json(await snapshot()); } catch (error) { next(error); }
});
app.get("/api/project", async (_req, res, next) => { try { res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/open", async (req, res, next) => {
  try {
    if (typeof req.body.path !== "string") throw new Error("path is required");
    projectRoot = path.resolve(req.body.path);
    const inspection = await inspectManifest(projectRoot);
    if (!inspection.valid) return res.status(409).json({ error: "This project needs repair before it can be opened", inspection, root: projectRoot });
    const indexed = await indexProject(projectRoot);
    await rememberProject(projectRoot, indexed.manifest.name);
    await watchProject();
    res.json(await snapshot());
  } catch (error) { next(error); }
});
app.get("/api/manifest/inspect", async (_req, res, next) => { try { res.json(await inspectManifest(projectRoot)); } catch (error) { next(error); } });
app.post("/api/manifest/migrate", async (_req, res, next) => { try { await migrateManifest(projectRoot); broadcast("project-changed"); res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/manifest/repair", async (req, res, next) => { try { await repairManifest(projectRoot, req.body ?? {}); await rememberProject(projectRoot, String(req.body?.name ?? path.basename(projectRoot))); await watchProject(); res.json(await snapshot()); } catch (error) { next(error); } });

app.post("/api/documents", async (req, res, next) => { try { await createDocument(projectRoot, String(req.body.path), req.body.frontmatter ?? {}, String(req.body.body ?? "")); res.status(201).json(await snapshot()); } catch (error) { next(error); } });
app.put("/api/documents/*path", async (req, res, next) => {
  try { const relative = Array.isArray(req.params.path) ? req.params.path.join("/") : String(req.params.path); await writeDocument(projectRoot, relative, req.body.frontmatter ?? {}, String(req.body.body ?? "")); res.json({ ok: true }); } catch (error) { next(error); }
});
app.post("/api/documents/rename", async (req, res, next) => { try { await renameDocument(projectRoot, String(req.body.from), String(req.body.to)); res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/documents/duplicate", async (req, res, next) => { try { await duplicateDocument(projectRoot, String(req.body.from), String(req.body.to)); res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/documents/archive", async (req, res, next) => { try { res.json({ item: await archiveItem(projectRoot, String(req.body.path)), snapshot: await snapshot() }); } catch (error) { next(error); } });
app.post("/api/archive/restore", async (req, res, next) => { try { await restoreArchivedItem(projectRoot, String(req.body.id)); res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/archive/trash", async (req, res, next) => { try { await moveArchiveToTrash(projectRoot, String(req.body.id)); res.json(await snapshot()); } catch (error) { next(error); } });
app.delete("/api/trash", async (req, res, next) => { try { await permanentlyDeleteTrashItem(projectRoot, String(req.body.id), String(req.body.confirmation)); res.json({ ok: true }); } catch (error) { next(error); } });

app.post("/api/revisions/init", async (_req, res, next) => { try { await ensureRepository(projectRoot); res.json(await revisionStatus(projectRoot)); } catch (error) { next(error); } });
app.post("/api/revisions/bookmarks", async (req, res, next) => { try { await createBookmark(projectRoot, String(req.body.message ?? "")); res.json(await revisionStatus(projectRoot)); } catch (error) { next(error); } });
app.post("/api/revisions/bookmarks/restore", async (req, res, next) => { try { await restoreBookmark(projectRoot, String(req.body.id)); broadcast("project-changed"); res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/revisions/timelines", async (req, res, next) => { try { await createTimeline(projectRoot, String(req.body.name ?? "")); res.json(await revisionStatus(projectRoot)); } catch (error) { next(error); } });
app.post("/api/revisions/timelines/switch", async (req, res, next) => { try { await switchTimeline(projectRoot, String(req.body.name ?? "")); broadcast("timeline-changed"); res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/revisions/timelines/bookmark-and-switch", async (req, res, next) => { try { await bookmarkAndSwitch(projectRoot, String(req.body.message ?? ""), String(req.body.name ?? "")); broadcast("timeline-changed"); res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/revisions/timelines/rename", async (req, res, next) => { try { await renameTimeline(projectRoot, String(req.body.current), String(req.body.name)); res.json(await revisionStatus(projectRoot)); } catch (error) { next(error); } });
app.delete("/api/revisions/timelines", async (req, res, next) => { try { await deleteTimeline(projectRoot, String(req.body.name)); res.json(await revisionStatus(projectRoot)); } catch (error) { next(error); } });

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});

await watchProject();
server.listen(port, () => console.log(`Loom Studio: http://localhost:${port}\nProject: ${projectRoot}`));
