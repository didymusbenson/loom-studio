import type { Express } from "express";
import { builtinEnginePacks, getEnginePack } from "./engine-packs.js";
import { compileRuntime } from "./runtime.js";
import { GenericFilesystemAdapter } from "./assistants.js";
import { acceptProposal, createProposal, editProposal, listProposals, rejectProposal } from "./proposals.js";

export function registerMilestone2Routes(app: Express, projectRoot: () => string, changed: (type: string) => void): void {
  const adapter = new GenericFilesystemAdapter();
  app.get("/api/engines", async (_req, res, next) => { try { res.json(await Promise.all(builtinEnginePacks.map(async pack => ({ id: pack.id, displayName: pack.displayName, version: pack.version, installed: await pack.inspect(projectRoot()) })))); } catch (error) { next(error); } });
  app.post("/api/engines/:id/install", async (req, res, next) => { try { const value = await getEnginePack(req.params.id).install(projectRoot()); changed("engine-changed"); res.status(201).json(value); } catch (error) { next(error); } });
  app.post("/api/engines/:id/upgrade", async (req, res, next) => { try { const value = await getEnginePack(req.params.id).upgrade(projectRoot()); changed("engine-changed"); res.json(value); } catch (error) { next(error); } });
  app.delete("/api/engines/:id", async (req, res, next) => { try { await getEnginePack(req.params.id).remove(projectRoot()); changed("engine-changed"); res.json({ ok: true }); } catch (error) { next(error); } });
  app.post("/api/runtime/compile", async (req, res, next) => { try { res.json({ files: await compileRuntime(projectRoot(), String(req.body?.engineId ?? "generic-filesystem")) }); changed("runtime-compiled"); } catch (error) { next(error); } });
  app.get("/api/assistants/sessions", async (_req, res, next) => { try { res.json({ adapter: { id: adapter.id, displayName: adapter.displayName, capabilities: adapter.capabilities }, sessions: await adapter.listSessions(projectRoot()) }); } catch (error) { next(error); } });
  app.get("/api/assistants/sessions/:id/events", async (req, res, next) => { try { res.json(await adapter.readEvents(projectRoot(), req.params.id, typeof req.query.after === "string" ? req.query.after : undefined)); } catch (error) { next(error); } });
  app.get("/api/proposals", async (_req, res, next) => { try { res.json(await listProposals(projectRoot())); } catch (error) { next(error); } });
  app.post("/api/proposals", async (req, res, next) => { try { const value = await createProposal(projectRoot(), req.body); changed("proposal-changed"); res.status(201).json(value); } catch (error) { next(error); } });
  app.put("/api/proposals/:id", async (req, res, next) => { try { const value = await editProposal(projectRoot(), req.params.id, req.body.files); changed("proposal-changed"); res.json(value); } catch (error) { next(error); } });
  app.post("/api/proposals/:id/accept", async (req, res, next) => { try { const value = await acceptProposal(projectRoot(), req.params.id, req.body ?? {}); changed("proposal-accepted"); res.json(value); } catch (error) { next(error); } });
  app.post("/api/proposals/:id/reject", async (req, res, next) => { try { const value = await rejectProposal(projectRoot(), req.params.id); changed("proposal-rejected"); res.json(value); } catch (error) { next(error); } });
}
