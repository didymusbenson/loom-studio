const byId = id => document.getElementById(id);
const request = async (url, options = {}) => {
  const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Loom Studio could not complete that action");
  return payload;
};
const clean = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const ask = (message, initial = "") => { const answer = window.prompt(message, initial); return answer === null ? null : answer.trim(); };
const snapshot = () => request("/api/project");

function activePath() { return byId("manuscript-editor")?.dataset.path || ""; }
async function activeDocument() { const data = await snapshot(); return data.graph.manuscripts.find(item => item.path === activePath()) || null; }

function installDocumentActions() {
  const bar = document.querySelector(".page-actions");
  if (!bar || byId("rename-document")) return;
  const rename = document.createElement("button"); rename.id = "rename-document"; rename.textContent = "Rename"; bar.prepend(rename);
  rename.onclick = async () => {
    const documentRecord = await activeDocument(); if (!documentRecord) return;
    const title = ask("Rename this page", documentRecord.title); if (!title) return;
    const folder = documentRecord.path.includes("/") ? documentRecord.path.slice(0, documentRecord.path.lastIndexOf("/") + 1) : "";
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `page-${Date.now()}`;
    const destination = `${folder}${slug}.md`;
    await request(`/api/documents/${encodeURI(documentRecord.path)}`, { method: "PUT", body: JSON.stringify({ frontmatter: { ...documentRecord.frontmatter, title }, body: documentRecord.body }) });
    if (destination !== documentRecord.path) await request("/api/documents/rename", { method: "POST", body: JSON.stringify({ from: documentRecord.path, to: destination }) });
    await load({ preserveDraft: false });
  };
}

function installDragOrdering() {
  const list = byId("toc-list"); if (!list || list.dataset.orderingInstalled) return;
  list.dataset.orderingInstalled = "true"; let dragged = null;
  list.addEventListener("dragstart", event => { const button = event.target.closest("button"); if (!button) return; dragged = button; button.classList.add("dragging"); event.dataTransfer.effectAllowed = "move"; });
  list.addEventListener("dragover", event => { event.preventDefault(); const target = event.target.closest("button"); if (!dragged || !target || target === dragged) return; const box = target.getBoundingClientRect(); list.insertBefore(dragged, event.clientY < box.top + box.height / 2 ? target : target.nextSibling); });
  list.addEventListener("dragend", async () => {
    if (!dragged) return; dragged.classList.remove("dragging"); dragged = null;
    const data = await snapshot();
    const paths = [...list.querySelectorAll("button")].map(button => data.graph.manuscripts.find(item => item.title === button.textContent)?.path).filter(Boolean);
    try { await request("/api/documents/reorder", { method: "POST", body: JSON.stringify({ paths }) }); await load({ preserveDraft: false }); }
    catch (error) { alert(error.message); await load(); }
  });
}

function archiveMarkup(data) {
  const archive = data.archive?.length ? data.archive.map(item => `<article class="archive-card"><strong>${clean(item.originalPath)}</strong><small>Archived ${clean(new Date(item.archivedAt).toLocaleString())}</small><button data-restore="${clean(item.id)}">Restore</button><button data-trash="${clean(item.id)}">Move to Trash</button></article>`).join("") : "<p>The archive is empty.</p>";
  const trash = data.trash?.length ? data.trash.map(item => `<article class="archive-card danger"><strong>${clean(item.originalPath)}</strong><small>This copy can still be permanently destroyed.</small><button data-destroy="${clean(item.id)}">Delete forever…</button></article>`).join("") : "<p>Trash is empty.</p>";
  return `<section><h3>Archive</h3>${archive}</section><section><h3>Trash</h3>${trash}</section>`;
}

function installArchiveAndTrash() {
  const trigger = byId("show-archive"); if (!trigger) return;
  trigger.onclick = async () => {
    const data = await snapshot(); openDrawer("Archive & Trash", archiveMarkup(data)); const drawer = byId("drawer-content");
    drawer.querySelectorAll("[data-restore]").forEach(button => button.onclick = async () => { await request("/api/archive/restore", { method: "POST", body: JSON.stringify({ id: button.dataset.restore }) }); byId("drawer-dialog").close(); await load(); });
    drawer.querySelectorAll("[data-trash]").forEach(button => button.onclick = async () => { await request("/api/archive/trash", { method: "POST", body: JSON.stringify({ id: button.dataset.trash }) }); byId("drawer-dialog").close(); await load(); });
    drawer.querySelectorAll("[data-destroy]").forEach(button => button.onclick = async () => { const confirmation = ask('This cannot be undone. Type DELETE FOREVER to remove this item permanently.'); if (confirmation !== "DELETE FOREVER") return; await request("/api/trash", { method: "DELETE", body: JSON.stringify({ id: button.dataset.destroy, confirmation }) }); byId("drawer-dialog").close(); await load(); });
  };
}

function installTimelineManagement() {
  const label = document.querySelector(".timeline-label"); if (!label || byId("manage-timeline")) return;
  const manage = document.createElement("button"); manage.id = "manage-timeline"; manage.textContent = "Timeline options"; label.after(manage);
  manage.onclick = async () => {
    const data = await snapshot(); const current = data.revision.timeline;
    openDrawer("Alternate Timelines", data.revision.timelines.map(name => `<article class="history-card"><strong>${clean(name.replace(/^timeline\//, ""))}</strong>${name === current ? "<small>Current timeline</small>" : ""}<button data-rename-timeline="${clean(name)}">Rename</button>${name !== current ? `<button data-delete-timeline="${clean(name)}">Archive timeline</button>` : ""}</article>`).join("") || "<p>No alternate timelines yet.</p>");
    const drawer = byId("drawer-content");
    drawer.querySelectorAll("[data-rename-timeline]").forEach(button => button.onclick = async () => { const name = ask("New timeline name", button.dataset.renameTimeline.replace(/^timeline\//, "")); if (!name) return; await request("/api/revisions/timelines/rename", { method: "POST", body: JSON.stringify({ current: button.dataset.renameTimeline, name }) }); byId("drawer-dialog").close(); await load(); });
    drawer.querySelectorAll("[data-delete-timeline]").forEach(button => button.onclick = async () => { if (!confirm("Archive this alternate timeline? Its pages remain in project history, but it will no longer appear in the binder.")) return; await request("/api/revisions/timelines", { method: "DELETE", body: JSON.stringify({ name: button.dataset.deleteTimeline }) }); byId("drawer-dialog").close(); await load(); });
  };
}

function installAll() { installDocumentActions(); installDragOrdering(); installArchiveAndTrash(); installTimelineManagement(); }
const observer = new MutationObserver(installAll); observer.observe(document.documentElement, { childList: true, subtree: true }); installAll();
