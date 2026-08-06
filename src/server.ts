import path from "node:path";
import http from "node:http";
import express from "express";
import chokidar from "chokidar";
import { WebSocketServer } from "ws";
import { indexProject } from "./project.js";
import { writeDocument } from "./documents.js";
import { createBookmark, createTimeline, ensureRepository, revisionStatus, switchTimeline } from "./revisions.js";

const app = express();
const server = http.createServer(app);
const sockets = new WebSocketServer({ server, path: "/events" });
const port = Number(process.env.PORT ?? 4173);
let projectRoot = process.env.LOOM_PROJECT ? path.resolve(process.env.LOOM_PROJECT) : path.resolve("fixtures/sample-project");
let watcher: chokidar.FSWatcher | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.resolve("public")));

async function snapshot() {
  const indexed = await indexProject(projectRoot);
  return { root: projectRoot, ...indexed, revision: await revisionStatus(projectRoot) };
}

function broadcast(type: string) {
  const payload = JSON.stringify({ type, at: new Date().toISOString() });
  for (const client of sockets.clients) if (client.readyState === client.OPEN) client.send(payload);
}

async function watchProject() {
  await watcher?.close();
  watcher = chokidar.watch(projectRoot, { ignored: [/(^|[/\\])\../, /node_modules/, /\.git/], ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } });
  watcher.on("all", () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => broadcast("project-changed"), 200);
  });
}

app.get("/api/project", async (_req, res, next) => { try { res.json(await snapshot()); } catch (error) { next(error); } });
app.post("/api/open", async (req, res, next) => {
  try {
    if (typeof req.body.path !== "string") throw new Error("path is required");
    projectRoot = path.resolve(req.body.path);
    await indexProject(projectRoot);
    await watchProject();
    res.json(await snapshot());
  } catch (error) { next(error); }
});
app.put("/api/documents/*path", async (req, res, next) => {
  try {
    const relative = Array.isArray(req.params.path) ? req.params.path.join("/") : String(req.params.path);
    await writeDocument(projectRoot, relative, req.body.frontmatter ?? {}, String(req.body.body ?? ""));
    res.json({ ok: true });
  } catch (error) { next(error); }
});
app.post("/api/revisions/init", async (_req, res, next) => { try { await ensureRepository(projectRoot); res.json(await revisionStatus(projectRoot)); } catch (error) { next(error); } });
app.post("/api/revisions/bookmarks", async (req, res, next) => { try { await createBookmark(projectRoot, String(req.body.message ?? "")); res.json(await revisionStatus(projectRoot)); } catch (error) { next(error); } });
app.post("/api/revisions/timelines", async (req, res, next) => { try { await createTimeline(projectRoot, String(req.body.name ?? "")); res.json(await revisionStatus(projectRoot)); } catch (error) { next(error); } });
app.post("/api/revisions/timelines/switch", async (req, res, next) => { try { await switchTimeline(projectRoot, String(req.body.name ?? "")); broadcast("timeline-changed"); res.json(await snapshot()); } catch (error) { next(error); } });

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});

await watchProject();
server.listen(port, () => console.log(`Loom Studio: http://localhost:${port}\nProject: ${projectRoot}`));
