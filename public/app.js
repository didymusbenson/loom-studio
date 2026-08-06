let state = null;
let manuscriptIndex = 0;
let referenceDoc = null;
let referenceEditing = false;
let referenceOriginal = null;
let saveTimer = null;
let draggedPath = null;

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const uiKey = root => `loom-studio:ui:${root}`;

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Loom Studio could not complete that action");
    error.payload = payload;
    throw error;
  }
  return payload;
}

function promptFor(label, initial = "") {
  return new Promise(resolve => {
    const dialog = $("prompt-dialog");
    $("prompt-label").textContent = label;
    $("prompt-input").value = initial;
    dialog.onclose = () => resolve(dialog.returnValue === "default" ? $("prompt-input").value.trim() : null);
    dialog.showModal();
    $("prompt-input").focus();
  });
}

function currentManuscript() { return state?.graph.manuscripts[manuscriptIndex] ?? null; }
function rememberUi() {
  if (!state?.root) return;
  localStorage.setItem(uiKey(state.root), JSON.stringify({
    manuscriptId: currentManuscript()?.id ?? null,
    referenceId: referenceDoc?.id ?? null,
  }));
}
function restoreUi() {
  if (!state?.root) return;
  try {
    const saved = JSON.parse(localStorage.getItem(uiKey(state.root)) || "{}");
    const manuscript = state.graph.manuscripts.findIndex(doc => doc.id === saved.manuscriptId);
    if (manuscript >= 0) manuscriptIndex = manuscript;
    referenceDoc = state.graph.documents.find(doc => doc.id === saved.referenceId) ?? null;
  } catch { /* local state is disposable */ }
}

function schemaFields(doc) {
  const base = ["title", "status", "tags"];
  const byType = {
    chapter: ["pov", "location", "characters_present"],
    scene: ["pov", "location", "characters_present"],
    character: ["name", "role", "pronouns", "aliases"],
    location: ["name", "region", "tags"],
    relationship: ["from", "to", "relationship"],
    observation: ["subject", "source", "tags"],
    world: ["name", "category", "tags"],
    note: ["topic", "tags"],
  };
  return [...new Set([...base, ...(byType[doc.type] || [])])];
}

function metadataMarkup(doc) {
  return schemaFields(doc).map(name => {
    const raw = name === "title" ? doc.title : name === "status" ? doc.status : doc.frontmatter[name];
    const value = Array.isArray(raw) ? raw.join(", ") : raw ?? "";
    return `<label>${esc(name.replaceAll("_", " "))}<input data-field="${esc(name)}" value="${esc(value)}"></label>`;
  }).join("");
}

function bindMetadata(container, editor) {
  container.querySelectorAll("input[data-field]").forEach(input => {
    input.onchange = () => {
      const frontmatter = JSON.parse(editor.dataset.frontmatter || "{}");
      const name = input.dataset.field;
      const listFields = new Set(["tags", "characters_present", "aliases"]);
      frontmatter[name] = listFields.has(name)
        ? input.value.split(",").map(value => value.trim()).filter(Boolean)
        : input.value;
      editor.dataset.frontmatter = JSON.stringify(frontmatter);
      scheduleSave(editor);
    };
  });
}

function selectManuscript(index, preserveCursor = false) {
  const docs = state?.graph.manuscripts || [];
  if (!docs.length) {
    $("manuscript-title").textContent = "Your manuscript";
    $("manuscript-editor").value = "";
    $("manuscript-editor").placeholder = "No pages yet. Use ＋ to create your opening chapter.";
    $("manuscript-editor").disabled = true;
    $("manuscript-fields").innerHTML = "";
    $("word-count").textContent = "0 words";
    return;
  }
  $("manuscript-editor").disabled = false;
  manuscriptIndex = Math.max(0, Math.min(index, docs.length - 1));
  const doc = docs[manuscriptIndex];
  const editor = $("manuscript-editor");
  const selection = preserveCursor && editor.dataset.path === doc.path ? [editor.selectionStart, editor.selectionEnd] : null;
  $("manuscript-title").textContent = doc.title;
  editor.value = doc.body;
  editor.dataset.path = doc.path;
  editor.dataset.frontmatter = JSON.stringify(doc.frontmatter);
  editor.dataset.modified = doc.modifiedAt;
  $("manuscript-fields").innerHTML = metadataMarkup(doc);
  bindMetadata($("manuscript-fields"), editor);
  $("word-count").textContent = `${doc.wordCount} words`;
  $("warnings").textContent = doc.warnings.join(" · ");
  document.querySelectorAll("#toc-list button").forEach(button => button.classList.toggle("active", button.dataset.path === doc.path));
  if (selection) editor.setSelectionRange(...selection);
  rememberUi();
}

function selectReference(doc) {
  referenceDoc = doc;
  referenceEditing = false;
  referenceOriginal = { body: doc.body, frontmatter: JSON.stringify(doc.frontmatter) };
  $("reference-title").textContent = doc.title;
  const editor = $("reference-editor");
  editor.value = doc.body;
  editor.dataset.path = doc.path;
  editor.dataset.frontmatter = JSON.stringify(doc.frontmatter);
  editor.readOnly = true;
  $("toggle-reference").textContent = "Edit";
  $("discard-reference").hidden = true;
  $("reference-fields").innerHTML = metadataMarkup(doc);
  bindMetadata($("reference-fields"), editor);
  document.querySelectorAll("#reference-tabs button").forEach(button => button.classList.toggle("active", button.dataset.path === doc.path));
  rememberUi();
}

function renderReferences() {
  const categories = Object.keys(state.graph.references);
  $("category-list").replaceChildren(...categories.map(category => {
    const button = document.createElement("button");
    button.textContent = category.replace(/\b\w/g, c => c.toUpperCase());
    button.onclick = () => {
      document.querySelectorAll("#category-list button").forEach(item => item.classList.toggle("active", item === button));
      const docs = state.graph.references[category] || [];
      $("reference-tabs").replaceChildren(...docs.map(doc => {
        const tab = document.createElement("button");
        tab.textContent = doc.title;
        tab.dataset.path = doc.path;
        tab.onclick = () => {
          if (referenceEditing && !confirm("Discard unsaved reference edits and open another tab?")) return;
          selectReference(doc);
        };
        return tab;
      }));
      const target = docs.find(doc => doc.id === referenceDoc?.id) || docs[0];
      if (target) selectReference(target);
      else {
        $("reference-title").textContent = "Reference notes";
        $("reference-editor").value = "";
        $("reference-editor").placeholder = "This divider has no notes yet.";
        $("reference-fields").innerHTML = "";
      }
    };
    return button;
  }));
  if (categories[0]) $("category-list").firstChild.click();
}

function renderToc() {
  const buttons = state.graph.manuscripts.map(doc => {
    const button = document.createElement("button");
    button.textContent = doc.title;
    button.dataset.path = doc.path;
    button.draggable = true;
    button.onclick = () => selectManuscript(state.graph.manuscripts.findIndex(item => item.id === doc.id));
    button.ondragstart = event => { draggedPath = doc.path; event.dataTransfer.effectAllowed = "move"; button.classList.add("dragging"); };
    button.ondragover = event => {
      event.preventDefault();
      if (!draggedPath || draggedPath === doc.path) return;
      const dragged = $("toc-list").querySelector(`[data-path="${CSS.escape(draggedPath)}"]`);
      const box = button.getBoundingClientRect();
      $("toc-list").insertBefore(dragged, event.clientY < box.top + box.height / 2 ? button : button.nextSibling);
    };
    button.ondragend = async () => {
      button.classList.remove("dragging");
      draggedPath = null;
      const paths = [...$("toc-list").querySelectorAll("button")].map(item => item.dataset.path);
      try { state = await api("/api/documents/reorder", { method:"POST", body:JSON.stringify({ paths }) }); render(); }
      catch (error) { alert(error.message); await load(); }
    };
    return button;
  });
  $("toc-list").replaceChildren(...buttons);
}

function render() {
  if (!state) return;
  $("project-name").textContent = `— ${state.manifest.name}`;
  $("health-count").textContent = state.graph.diagnostics.length ? `(${state.graph.diagnostics.length})` : "";
  renderToc();
  renderReferences();
  $("timeline").replaceChildren(...state.revision.timelines.map(name => Object.assign(document.createElement("option"), {
    value: name,
    textContent: name.replace(/^timeline\//, ""),
    selected: name === state.revision.timeline,
  })));
  selectManuscript(Math.min(manuscriptIndex, state.graph.manuscripts.length - 1));
}

async function load({ preserveDraft = true, preserveCursor = true } = {}) {
  const editor = $("manuscript-editor");
  const draft = preserveDraft && $("save-state").textContent.startsWith("Unsaved") ? {
    path: editor.dataset.path, body: editor.value, frontmatter: editor.dataset.frontmatter,
    selection: [editor.selectionStart, editor.selectionEnd],
  } : null;
  state = await api("/api/project");
  restoreUi();
  render();
  if (draft && currentManuscript()?.path === draft.path) {
    editor.value = draft.body;
    editor.dataset.frontmatter = draft.frontmatter;
    if (preserveCursor) editor.setSelectionRange(...draft.selection);
    $("save-state").textContent = "Unsaved (external change held)";
  }
}

function scheduleSave(editor) {
  $("save-state").textContent = "Unsaved";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveEditor(editor).catch(showError), 650);
}

async function saveEditor(editor) {
  if (!editor.dataset.path) return;
  $("save-state").textContent = "Saving…";
  const selection = [editor.selectionStart, editor.selectionEnd];
  await api(`/api/documents/${editor.dataset.path}`, { method:"PUT", body:JSON.stringify({
    frontmatter: JSON.parse(editor.dataset.frontmatter || "{}"), body: editor.value,
  }) });
  $("save-state").textContent = "Saved";
  await load({ preserveDraft:false, preserveCursor:false });
  if ($("manuscript-editor").dataset.path === editor.dataset.path) $("manuscript-editor").setSelectionRange(...selection);
}

function showError(error) { alert(error?.message || String(error)); }
function openDrawer(title, html) { $("drawer-title").textContent = title; $("drawer-content").innerHTML = html; $("drawer-dialog").showModal(); }

$("manuscript-editor").addEventListener("input", event => {
  const words = event.target.value.trim().match(/\b[\w’'-]+\b/g) || [];
  $("word-count").textContent = `${words.length} words`;
  scheduleSave(event.target);
});

$("toggle-reference").onclick = async () => {
  if (!referenceDoc) return;
  const editor = $("reference-editor");
  if (!referenceEditing) {
    referenceEditing = true;
    referenceOriginal = { body:editor.value, frontmatter:editor.dataset.frontmatter };
    editor.readOnly = false;
    $("toggle-reference").textContent = "Save";
    $("discard-reference").hidden = false;
    editor.focus();
  } else {
    await saveEditor(editor);
    referenceEditing = false;
    editor.readOnly = true;
    $("toggle-reference").textContent = "Edit";
    $("discard-reference").hidden = true;
  }
};
$("discard-reference").onclick = () => {
  const editor = $("reference-editor");
  editor.value = referenceOriginal.body;
  editor.dataset.frontmatter = referenceOriginal.frontmatter;
  referenceEditing = false;
  editor.readOnly = true;
  $("toggle-reference").textContent = "Edit";
  $("discard-reference").hidden = true;
};

$("previous").onclick = () => selectManuscript(manuscriptIndex - 1);
$("next").onclick = () => selectManuscript(manuscriptIndex + 1);
$("new-document").onclick = async () => {
  const title = await promptFor("Chapter or scene title", "Untitled Chapter");
  if (!title) return;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `page-${Date.now()}`;
  state = await api("/api/documents", { method:"POST", body:JSON.stringify({
    path:`manuscript/${slug}.md`, frontmatter:{ type:"chapter", title, order:state.graph.manuscripts.length + 1 }, body:`# ${title}\n\n`,
  }) });
  manuscriptIndex = state.graph.manuscripts.findIndex(doc => doc.path === `manuscript/${slug}.md`);
  render();
};
$("duplicate-document").onclick = async () => {
  const doc = currentManuscript(); if (!doc) return;
  const stem = doc.path.replace(/\.md$/i, "");
  state = await api("/api/documents/duplicate", { method:"POST", body:JSON.stringify({ from:doc.path, to:`${stem}-copy.md` }) });
  render();
};
$("rename-document").onclick = async () => {
  const doc = currentManuscript(); if (!doc) return;
  const title = await promptFor("Rename this page", doc.title); if (!title) return;
  const folder = doc.path.slice(0, doc.path.lastIndexOf("/") + 1);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `page-${Date.now()}`;
  await api(`/api/documents/${doc.path}`, { method:"PUT", body:JSON.stringify({ frontmatter:{ ...doc.frontmatter, title }, body:doc.body }) });
  state = await api("/api/documents/rename", { method:"POST", body:JSON.stringify({ from:doc.path, to:`${folder}${slug}.md` }) });
  render();
};
$("archive-document").onclick = async () => {
  const doc = currentManuscript();
  if (!doc || !confirm(`Archive “${doc.title}”? You can restore it later.`)) return;
  const result = await api("/api/documents/archive", { method:"POST", body:JSON.stringify({ path:doc.path }) });
  state = result.snapshot;
  manuscriptIndex = Math.max(0, manuscriptIndex - 1);
  render();
};

$("search").oninput = event => {
  const query = event.target.value.trim().toLowerCase();
  if (!query) return $("search-results").replaceChildren();
  const matches = state.graph.documents.filter(doc => doc.title.toLowerCase().includes(query) || doc.body.toLowerCase().includes(query) || doc.tags.some(tag => tag.toLowerCase().includes(query))).slice(0, 30);
  $("search-results").innerHTML = matches.map(doc => `<button class="search-card" data-id="${esc(doc.id)}"><strong>${esc(doc.title)}</strong><small>${esc(doc.category)} · ${doc.wordCount} words</small></button>`).join("") || "<p>No matching cards.</p>";
  $("search-results").querySelectorAll("button").forEach(button => button.onclick = () => {
    const doc = state.graph.documents.find(item => item.id === button.dataset.id);
    if (doc?.kind === "manuscript") selectManuscript(state.graph.manuscripts.findIndex(item => item.id === doc.id));
    else if (doc) selectReference(doc);
  });
};

$("show-health").onclick = () => {
  const html = state.graph.diagnostics.length ? state.graph.diagnostics.map(item => {
    const action = item.code === "missing-character" ? `<button data-create-character="${esc(item.target || "New Character")}">Create character sheet</button>` : "";
    return `<article class="health-card ${esc(item.severity)}"><strong>${esc(item.message)}</strong><small>${esc(item.path || item.code)}</small>${action}</article>`;
  }).join("") : "<p>No project-health issues found.</p>";
  openDrawer("Project Health", html);
  $("drawer-content").querySelectorAll("[data-create-character]").forEach(button => button.onclick = async () => {
    const name = button.dataset.createCharacter;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    state = await api("/api/documents", { method:"POST", body:JSON.stringify({ path:`characters/${slug}.md`, frontmatter:{ type:"character", name, title:name }, body:`# ${name}\n\n` }) });
    $("drawer-dialog").close(); render();
  });
};

$("show-archive").onclick = () => {
  const archive = state.archive.length ? state.archive.map(item => `<article class="archive-card"><strong>${esc(item.originalPath)}</strong><small>Archived ${esc(new Date(item.archivedAt).toLocaleString())}</small><button data-restore="${esc(item.id)}">Restore</button><button data-trash="${esc(item.id)}">Move to Trash</button></article>`).join("") : "<p>The archive is empty.</p>";
  const trash = state.trash.length ? state.trash.map(item => `<article class="archive-card danger"><strong>${esc(item.originalPath)}</strong><small>Permanent deletion cannot be undone.</small><button data-destroy="${esc(item.id)}">Delete forever…</button></article>`).join("") : "<p>Trash is empty.</p>";
  openDrawer("Archive & Trash", `<section><h3>Archive</h3>${archive}</section><section><h3>Trash</h3>${trash}</section>`);
  $("drawer-content").querySelectorAll("[data-restore]").forEach(button => button.onclick = async () => { state = await api("/api/archive/restore", { method:"POST", body:JSON.stringify({ id:button.dataset.restore }) }); $("drawer-dialog").close(); render(); });
  $("drawer-content").querySelectorAll("[data-trash]").forEach(button => button.onclick = async () => { state = await api("/api/archive/trash", { method:"POST", body:JSON.stringify({ id:button.dataset.trash }) }); $("drawer-dialog").close(); render(); });
  $("drawer-content").querySelectorAll("[data-destroy]").forEach(button => button.onclick = async () => {
    const confirmation = await promptFor("This cannot be undone. Type DELETE FOREVER.");
    if (confirmation !== "DELETE FOREVER") return;
    state = await api("/api/trash", { method:"DELETE", body:JSON.stringify({ id:button.dataset.destroy, confirmation }) });
    $("drawer-dialog").close(); render();
  });
};

$("bookmark").onclick = async () => { const message = await promptFor("Name this bookmark"); if (message) { state.revision = await api("/api/revisions/bookmarks", { method:"POST", body:JSON.stringify({ message }) }); render(); } };
$("history").onclick = () => {
  openDrawer("Bookmarks", state.revision.bookmarks.map(item => `<article class="history-card"><strong>${esc(item.message)}</strong><small>${esc(new Date(item.date).toLocaleString())}</small><button data-restore-bookmark="${esc(item.id)}">Go back here</button></article>`).join("") || "<p>No bookmarks yet.</p>");
  $("drawer-content").querySelectorAll("[data-restore-bookmark]").forEach(button => button.onclick = async () => {
    if (!confirm("Go back to this bookmark? Unbookmarked work will be replaced.")) return;
    state = await api("/api/revisions/bookmarks/restore", { method:"POST", body:JSON.stringify({ id:button.dataset.restoreBookmark }) });
    $("drawer-dialog").close(); render();
  });
};
$("new-timeline").onclick = async () => { const name = await promptFor("Name the new timeline"); if (name) { state.revision = await api("/api/revisions/timelines", { method:"POST", body:JSON.stringify({ name }) }); await load(); } };
$("manage-timeline").onclick = () => {
  const current = state.revision.timeline;
  openDrawer("Alternate Timelines", state.revision.timelines.map(name => `<article class="history-card"><strong>${esc(name.replace(/^timeline\//, ""))}</strong>${name === current ? "<small>Current timeline</small>" : ""}<button data-rename-timeline="${esc(name)}">Rename</button>${name !== current ? `<button data-delete-timeline="${esc(name)}">Archive timeline</button>` : ""}</article>`).join(""));
  $("drawer-content").querySelectorAll("[data-rename-timeline]").forEach(button => button.onclick = async () => { const name = await promptFor("New timeline name", button.dataset.renameTimeline.replace(/^timeline\//, "")); if (name) { state.revision = await api("/api/revisions/timelines/rename", { method:"POST", body:JSON.stringify({ current:button.dataset.renameTimeline, name }) }); $("drawer-dialog").close(); render(); } });
  $("drawer-content").querySelectorAll("[data-delete-timeline]").forEach(button => button.onclick = async () => { if (confirm("Archive this alternate timeline?")) { state.revision = await api("/api/revisions/timelines", { method:"DELETE", body:JSON.stringify({ name:button.dataset.deleteTimeline }) }); $("drawer-dialog").close(); render(); } });
};
$("timeline").onchange = async event => {
  try { state = await api("/api/revisions/timelines/switch", { method:"POST", body:JSON.stringify({ name:event.target.value }) }); render(); }
  catch {
    const message = await promptFor("Unbookmarked changes found. Name a bookmark to save and switch.", "Before switching timeline");
    if (message) { state = await api("/api/revisions/timelines/bookmark-and-switch", { method:"POST", body:JSON.stringify({ message, name:event.target.value }) }); render(); }
    else render();
  }
};

async function renderLibrary() {
  const library = await api("/api/library");
  $("recent-projects").innerHTML = library.recent.map(item => `<article class="recent-card"><div><strong>${esc(item.name)}</strong><small>${esc(item.root)}</small></div><div><button data-open="${esc(item.root)}">Open</button><button data-forget="${esc(item.root)}">Remove</button></div></article>`).join("") || "<p>No recent projects yet. Create a binder or open an existing folder.</p>";
  $("recent-projects").querySelectorAll("[data-open]").forEach(button => button.onclick = () => openProject(button.dataset.open));
  $("recent-projects").querySelectorAll("[data-forget]").forEach(button => button.onclick = async () => { await api("/api/library/recent", { method:"DELETE", body:JSON.stringify({ path:button.dataset.forget }) }); await renderLibrary(); });
}
async function openProject(projectPath) {
  try {
    state = await api("/api/open", { method:"POST", body:JSON.stringify({ path:projectPath }) });
    $("library-dialog").close(); referenceDoc = null; restoreUi(); render();
  } catch (error) {
    if (error.payload?.inspection) {
      const name = await promptFor(`This project needs repair: ${error.payload.inspection.errors?.join("; ") || "invalid loom.json"}. Enter its project name.`, error.payload.inspection.name || "Recovered Project");
      if (!name) return;
      state = await api("/api/manifest/repair", { method:"POST", body:JSON.stringify({ name }) });
      $("library-dialog").close(); render();
    } else throw error;
  }
}
$("project-library").onclick = async () => { await renderLibrary(); $("library-dialog").showModal(); };
$("open-project").onclick = async () => { const value = await promptFor("Absolute path to a Loom project"); if (value) await openProject(value); };
$("create-project").onclick = () => $("create-dialog").showModal();
$("create-dialog").addEventListener("close", async () => {
  if ($("create-dialog").returnValue !== "default") return;
  const data = Object.fromEntries(new FormData($("create-form")));
  try { state = await api("/api/projects", { method:"POST", body:JSON.stringify(data) }); $("library-dialog").close(); referenceDoc = null; render(); }
  catch (error) { showError(error); }
});

window.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveEditor(document.activeElement === $("reference-editor") ? $("reference-editor") : $("manuscript-editor")).catch(showError); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") { event.preventDefault(); $("bookmark").click(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") { event.preventDefault(); $("search").focus(); }
});
window.addEventListener("beforeunload", event => { if ($("save-state").textContent.startsWith("Unsaved")) { event.preventDefault(); event.returnValue = ""; } });

const protocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${protocol}://${location.host}/events`);
socket.onmessage = () => load().catch(console.error);
load().catch(async error => { showError(error); await renderLibrary(); $("library-dialog").showModal(); });
