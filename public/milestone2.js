const m2 = id => document.getElementById(id);
const m2api = async (url, options = {}) => { const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Assistant desk action failed"); return data; };
const m2esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let selectedSession = null;

async function renderAssistantDesk() {
  const [sessionData, proposals, engines] = await Promise.all([m2api("/api/assistants/sessions"), m2api("/api/proposals"), m2api("/api/engines")]);
  m2("assistant-capabilities").textContent = Object.entries(sessionData.adapter.capabilities).filter(([, enabled]) => enabled).map(([name]) => name.replace(/[A-Z]/g, c => ` ${c.toLowerCase()}`)).join(" · ");
  m2("assistant-sessions").innerHTML = sessionData.sessions.length ? sessionData.sessions.map(session => `<button class="session-card ${session.id === selectedSession ? "active" : ""}" data-session="${m2esc(session.id)}"><strong>${m2esc(session.displayName)}</strong><small>${m2esc(session.status)} · ${m2esc(new Date(session.startedAt).toLocaleString())}</small></button>`).join("") : `<div class="assistant-empty">No assistant is reporting activity. Keep prompting in Claude Code, Codex, your terminal, or any tool you prefer.</div>`;
  m2("assistant-sessions").querySelectorAll("[data-session]").forEach(button => button.onclick = async () => { selectedSession = button.dataset.session; await renderAssistantDesk(); await renderEvents(); });
  m2("proposal-list").innerHTML = proposals.length ? proposals.map(proposal => `<article class="proposal-card ${m2esc(proposal.status)}"><header><strong>${m2esc(proposal.title)}</strong><span>${m2esc(proposal.status)}</span></header><p>${m2esc(proposal.summary)}</p>${proposal.files.map(file => `<details><summary>${m2esc(file.path)}</summary><textarea data-proposal="${m2esc(proposal.id)}" data-path="${m2esc(file.path)}">${m2esc(file.body)}</textarea></details>`).join("")}<footer>${proposal.status === "pending" || proposal.status === "stale" ? `<button data-accept="${m2esc(proposal.id)}">Accept${proposal.status === "stale" ? " anyway…" : ""}</button><button data-save-proposal="${m2esc(proposal.id)}">Save edits</button><button data-reject="${m2esc(proposal.id)}">Reject</button>` : ""}</footer></article>`).join("") : `<div class="assistant-empty">No proposed changes are waiting.</div>`;
  m2("proposal-list").querySelectorAll("[data-accept]").forEach(button => button.onclick = async () => { const stale = button.closest("article").classList.contains("stale"); if (stale && !confirm("The source changed after this proposal was created. Accepting may replace newer writing. Continue?")) return; const bookmark = prompt("Optional bookmark name before accepting", "Accept assistant proposal"); await m2api(`/api/proposals/${button.dataset.accept}/accept`, { method: "POST", body: JSON.stringify({ allowStale: stale, bookmark: bookmark || undefined }) }); await load({ preserveDraft: false }); await renderAssistantDesk(); });
  m2("proposal-list").querySelectorAll("[data-reject]").forEach(button => button.onclick = async () => { await m2api(`/api/proposals/${button.dataset.reject}/reject`, { method: "POST" }); await renderAssistantDesk(); });
  m2("proposal-list").querySelectorAll("[data-save-proposal]").forEach(button => button.onclick = async () => { const proposal = proposals.find(item => item.id === button.dataset.saveProposal); const files = proposal.files.map(file => ({ ...file, body: m2("proposal-list").querySelector(`textarea[data-proposal="${CSS.escape(proposal.id)}"][data-path="${CSS.escape(file.path)}"]`).value })); await m2api(`/api/proposals/${proposal.id}`, { method: "PUT", body: JSON.stringify({ files }) }); await renderAssistantDesk(); });
  m2("engine-list").innerHTML = engines.map(engine => `<article class="engine-card"><div><strong>${m2esc(engine.displayName)}</strong><small>v${m2esc(engine.version)} · ${engine.installed ? "installed" : "available"}</small></div><div>${engine.installed ? `<button data-upgrade-engine="${m2esc(engine.id)}">Refresh</button><button data-remove-engine="${m2esc(engine.id)}">Remove</button>` : `<button data-install-engine="${m2esc(engine.id)}">Install</button>`}</div></article>`).join("");
  m2("engine-list").querySelectorAll("[data-install-engine]").forEach(button => button.onclick = async () => { await m2api(`/api/engines/${button.dataset.installEngine}/install`, { method: "POST" }); await renderAssistantDesk(); });
  m2("engine-list").querySelectorAll("[data-upgrade-engine]").forEach(button => button.onclick = async () => { await m2api(`/api/engines/${button.dataset.upgradeEngine}/upgrade`, { method: "POST" }); await renderAssistantDesk(); });
  m2("engine-list").querySelectorAll("[data-remove-engine]").forEach(button => button.onclick = async () => { if (confirm("Remove this engine pack? Author documents are not removed.")) { await m2api(`/api/engines/${button.dataset.removeEngine}`, { method: "DELETE" }); await renderAssistantDesk(); } });
}
async function renderEvents() { if (!selectedSession) { m2("activity-feed").innerHTML = `<div class="assistant-empty">Select a session to see reported activity.</div>`; return; } const events = await m2api(`/api/assistants/sessions/${encodeURIComponent(selectedSession)}/events`); m2("activity-feed").innerHTML = events.length ? events.map(event => `<article class="activity-card ${m2esc(event.type)}"><time>${m2esc(new Date(event.at).toLocaleTimeString())}</time><strong>${m2esc(event.summary)}</strong>${event.path ? `<small>${m2esc(event.path)}</small>` : ""}</article>`).join("") : `<div class="assistant-empty">This session has not reported activity yet.</div>`; }

const deskBackdrop = document.createElement("div");
deskBackdrop.className = "assistant-desk-backdrop";
deskBackdrop.hidden = true;
document.body.append(deskBackdrop);

const desk = document.createElement("aside"); desk.id = "assistant-desk"; desk.className = "assistant-desk collapsed"; desk.setAttribute("aria-label", "Collaborator Desk"); desk.innerHTML = `<button id="assistant-desk-toggle" class="assistant-tab" aria-expanded="false" aria-controls="assistant-desk-body">Collaborators <span id="assistant-badge"></span></button><div id="assistant-desk-body" class="assistant-desk-body" aria-hidden="true"><header><div><h2>Collaborator Desk</h2><small id="assistant-capabilities"></small></div><button id="compile-runtime">Prepare context</button></header><nav class="assistant-desk-tabs" aria-label="Collaborator Desk sections"><button data-desk-tab="activity" class="active">Activity</button><button data-desk-tab="proposals">Proposed changes</button><button data-desk-tab="engines">Engine packs</button></nav><section data-desk-panel="activity"><div id="assistant-sessions"></div><div id="activity-feed"></div></section><section data-desk-panel="proposals" hidden><div id="proposal-list"></div></section><section data-desk-panel="engines" hidden><div id="engine-list"></div></section></div>`; document.body.append(desk);
const deskToggle = m2("assistant-desk-toggle");
const deskBody = m2("assistant-desk-body");
const narrowDesk = window.matchMedia("(max-width: 760px)");

function deskFocusables() {
  return [...desk.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], details summary')]
    .filter(element => !element.closest("[hidden]") && element.getClientRects().length);
}

function setWorkspaceInert(inert) {
  document.querySelectorAll("body > header, body > main").forEach(element => { element.inert = inert; });
}

function setDeskOpen(open, { returnFocus = false } = {}) {
  desk.classList.toggle("collapsed", !open);
  document.body.classList.toggle("assistant-desk-open", open);
  deskToggle.setAttribute("aria-expanded", String(open));
  deskBody.setAttribute("aria-hidden", String(!open));
  deskBody.inert = !open;
  deskBackdrop.hidden = !(open && narrowDesk.matches);
  const modal = open && narrowDesk.matches;
  setWorkspaceInert(modal);
  if (modal) {
    desk.setAttribute("role", "dialog");
    desk.setAttribute("aria-modal", "true");
  } else {
    desk.removeAttribute("role");
    desk.removeAttribute("aria-modal");
  }
  if (returnFocus) deskToggle.focus();
}

setDeskOpen(false);
deskToggle.onclick = async () => {
  const open = desk.classList.contains("collapsed");
  setDeskOpen(open);
  if (open) {
    await renderAssistantDesk();
    await renderEvents();
    if (narrowDesk.matches) m2("compile-runtime").focus();
  }
};
deskBackdrop.onclick = () => setDeskOpen(false, { returnFocus: true });
narrowDesk.onchange = () => setDeskOpen(!desk.classList.contains("collapsed"));
document.addEventListener("keydown", event => {
  if (desk.classList.contains("collapsed")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    setDeskOpen(false, { returnFocus: true });
    return;
  }
  if (event.key !== "Tab" || !narrowDesk.matches) return;
  const focusable = deskFocusables();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
desk.querySelectorAll("[data-desk-tab]").forEach(button => button.onclick = () => { desk.querySelectorAll("[data-desk-tab]").forEach(item => item.classList.toggle("active", item === button)); desk.querySelectorAll("[data-desk-panel]").forEach(panel => panel.hidden = panel.dataset.deskPanel !== button.dataset.deskTab); });
m2("compile-runtime").onclick = async () => { await m2api("/api/runtime/compile", { method: "POST", body: "{}" }); m2("compile-runtime").textContent = "Context ready"; setTimeout(() => m2("compile-runtime").textContent = "Prepare context", 1600); };
setInterval(async () => { if (!desk.classList.contains("collapsed")) { await renderAssistantDesk(); await renderEvents(); } }, 3000);
