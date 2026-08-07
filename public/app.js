let state = null;
let manuscriptIndex = 0;
let referenceDoc = null;
let referenceEditing = false;
let referenceOriginal = null;
let saveTimer = null;
let draggedPath = null;
let referenceCategory = null;

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const uiKey = root => `loom-studio:ui:${root}`;
const singularCategory = category => ({ characters:"character", locations:"location", relationships:"relationship", observations:"observation", notes:"note", world:"world note", project:"project note" }[category] || String(category || "reference").replace(/s$/, ""));
function showDialog(dialog) { dialog.returnValue = ""; dialog.showModal(); }

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
    showDialog(dialog);
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

function fieldValue(doc, name) {
  return name === "title" ? doc.title : name === "status" ? doc.status : doc.frontmatter[name];
}

function entityPillsMarkup(name, raw, entities) {
  const values = Array.isArray(raw) ? raw.map(String) : String(raw ?? "") ? [String(raw)] : [];
  const selected = values.map(value => entities.find(item => item.id === value || item.name === value) || { id:value, name:value });
  const kind = name === "location" ? "location" : "character";
  return `<div class="entity-field" data-entity-field="${esc(name)}"><span class="entity-label">${esc(name.replaceAll("_", " "))}</span><div class="entity-pills">${selected.map(item => `<button type="button" class="entity-pill" data-remove-entity="${esc(name)}" data-entity-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}"><span>${esc(item.name)}</span><span class="pill-remove" aria-hidden="true">×</span></button>`).join("")}<button type="button" class="entity-add" data-add-entity="${esc(name)}">＋ Add ${kind}</button></div></div>`;
}

function metadataMarkup(doc, editable = true) {
  return schemaFields(doc).map(name => {
    const raw = fieldValue(doc, name);
    const value = Array.isArray(raw) ? raw.join(", ") : raw ?? "";
    const label = name.replaceAll("_", " ");
    if (!editable) return value === "" ? "" : `<div class="metadata-value"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
    const entities = name === "location" ? state?.graph.locations
      : ["pov", "characters_present"].includes(name) ? state?.graph.characters
      : ["from", "to"].includes(name) ? [...(state?.graph.characters || []), ...(state?.graph.locations || [])]
      : null;
    if (entities) {
      if (["characters_present", "location"].includes(name)) return entityPillsMarkup(name, raw, entities);
      const selected = new Set(Array.isArray(raw) ? raw.map(String) : [String(raw ?? "")]);
      const multiple = name === "characters_present";
      const canCreate = !["from", "to"].includes(name);
      return `<label>${esc(label)}<select data-field="${esc(name)}"${multiple ? " multiple" : ""}>${multiple ? "" : '<option value="">None selected</option>'}${entities.map(item => `<option value="${esc(item.id)}"${selected.has(item.name) || selected.has(item.id) ? " selected" : ""}>${esc(item.name)}</option>`).join("")}${canCreate ? `<option value="__create__">＋ Create new ${name === "location" ? "location" : "character"}…</option>` : ""}</select>${multiple ? '<small>Hold Command or Ctrl to choose several.</small>' : ""}</label>`;
    }
    const renameOwned = doc.kind === "reference" && ["title", "name"].includes(name);
    return `<label>${esc(label)}<input data-field="${esc(name)}" value="${esc(value)}"${renameOwned ? ' disabled title="Use Rename to keep the name and filename together"' : ""}>${renameOwned ? "<small>Use Rename to change this safely.</small>" : ""}</label>`;
  }).join("");
}

function bindMetadata(container, editor) {
  container.querySelectorAll("[data-field]").forEach(input => {
    input.onchange = async () => {
      if (input instanceof HTMLSelectElement && [...input.selectedOptions].some(option => option.value === "__create__")) {
        const kind = input.dataset.field === "location" ? "location" : "character";
        const category = kind === "location" && !state.manifest.references.locations ? "world" : `${kind}s`;
        const created = await createReference(category, { type:kind, openForEdit:false });
        if (!created) { input.value = ""; return; }
        const option = new Option(created.name, created.id, true, true);
        input.add(option, input.querySelector('[value="__create__"]'));
      }
      const frontmatter = JSON.parse(editor.dataset.frontmatter || "{}");
      const name = input.dataset.field;
      const listFields = new Set(["tags", "characters_present", "aliases"]);
      frontmatter[name] = input instanceof HTMLSelectElement && input.multiple
        ? [...input.selectedOptions].map(option => option.value).filter(value => value !== "__create__")
        : listFields.has(name) ? input.value.split(",").map(value => value.trim()).filter(Boolean) : input.value;
      editor.dataset.frontmatter = JSON.stringify(frontmatter);
      if (editor === $("manuscript-editor")) scheduleSave(editor);
    };
  });
  container.querySelectorAll("[data-remove-entity]").forEach(button => button.onclick = () => {
    const frontmatter = JSON.parse(editor.dataset.frontmatter || "{}");
    const field = button.dataset.removeEntity;
    if (field === "characters_present") {
      const values = Array.isArray(frontmatter[field]) ? frontmatter[field].map(String) : [];
      frontmatter[field] = values.filter(value => value !== button.dataset.entityId && !state.graph.characters.some(item => item.id === button.dataset.entityId && item.name === value));
    } else frontmatter[field] = "";
    editor.dataset.frontmatter = JSON.stringify(frontmatter);
    if (editor === $("manuscript-editor")) scheduleSave(editor);
    refreshMetadata(container, editor);
  });
  container.querySelectorAll("[data-add-entity]").forEach(button => button.onclick = () => openEntityChooser(button.dataset.addEntity, container, editor));
}

function refreshMetadata(container, editor) {
  const source = editor === $("manuscript-editor") ? currentManuscript() : referenceDoc;
  if (!source) return;
  const frontmatter = JSON.parse(editor.dataset.frontmatter || "{}");
  container.innerHTML = metadataMarkup({ ...source, frontmatter, title:String(frontmatter.title ?? source.title), status:String(frontmatter.status ?? source.status) }, true);
  bindMetadata(container, editor);
}

async function openEntityChooser(field, container, editor) {
  const kind = field === "location" ? "location" : "character";
  const entities = kind === "location" ? state.graph.locations : state.graph.characters;
  const frontmatter = JSON.parse(editor.dataset.frontmatter || "{}");
  const current = new Set((Array.isArray(frontmatter[field]) ? frontmatter[field] : [frontmatter[field]]).filter(Boolean).map(String));
  const available = entities.filter(item => !current.has(item.id) && !current.has(item.name));
  const dialog = $("entity-dialog"), form = $("entity-form"), select = form.elements.entity;
  $("entity-dialog-title").textContent = `Add ${kind}`;
  $("entity-dialog-help").textContent = `Choose an existing ${kind}, or create a new one.`;
  $("entity-select-label").firstChild.textContent = `Choose ${kind}`;
  select.replaceChildren(...available.map(item => new Option(item.name, item.id)), new Option(`＋ Create new ${kind}…`, "__create__"));
  const submitted = await new Promise(resolve => { dialog.onclose = () => resolve(dialog.returnValue === "default"); showDialog(dialog); select.focus(); });
  if (!submitted) return;
  let value = select.value;
  if (value === "__create__") {
    const category = kind === "location" && !state.manifest.references.locations ? "world" : `${kind}s`;
    const created = await createReference(category, { type:kind, openForEdit:false });
    if (!created) return;
    value = created.id;
  }
  if (field === "characters_present") frontmatter[field] = [...current, value];
  else frontmatter[field] = value;
  editor.dataset.frontmatter = JSON.stringify(frontmatter);
  if (editor === $("manuscript-editor")) scheduleSave(editor);
  refreshMetadata(container, editor);
}

function inlineMarkdown(value) {
  return esc(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="#" data-project-link="${esc(href)}">${label}</a>`);
}

function renderMarkdown(source) {
  const lines = String(source || "").replace(/\r/g, "").split("\n");
  let html = "", paragraph = [], list = null, quote = [];
  const flushParagraph = () => { if (paragraph.length) html += `<p>${inlineMarkdown(paragraph.join(" "))}</p>`; paragraph = []; };
  const flushList = () => { if (list) html += `<${list.type}>${list.items.map(item => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`; list = null; };
  const flushQuote = () => { if (quote.length) html += `<blockquote>${inlineMarkdown(quote.join(" "))}</blockquote>`; quote = []; };
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/), bullet = line.match(/^\s*[-*+]\s+(.+)$/), ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); flushQuote(); html += `<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`; }
    else if (bullet || ordered) { flushParagraph(); flushQuote(); const type = bullet ? "ul" : "ol"; if (list?.type !== type) { flushList(); list = { type, items:[] }; } list.items.push((bullet || ordered)[1]); }
    else if (/^>\s?/.test(line)) { flushParagraph(); flushList(); quote.push(line.replace(/^>\s?/, "")); }
    else if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) { flushParagraph(); flushList(); flushQuote(); html += "<hr>"; }
    else if (!line.trim()) { flushParagraph(); flushList(); flushQuote(); }
    else paragraph.push(line.trim());
  }
  flushParagraph(); flushList(); flushQuote();
  return html || '<p class="empty-copy">Nothing has been written here yet.</p>';
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
  editor.hidden = true;
  $("reference-preview").hidden = false;
  $("reference-preview").innerHTML = renderMarkdown(doc.body);
  $("toggle-reference").textContent = "Edit";
  $("toggle-reference").hidden = false;
  $("discard-reference").hidden = true;
  $("rename-reference").hidden = false;
  $("reference-fields").innerHTML = metadataMarkup(doc, false);
  bindReferenceLinks();
  document.querySelectorAll("#reference-tabs button").forEach(button => button.classList.toggle("active", button.dataset.path === doc.path));
  rememberUi();
}

function renderReferences() {
  const categories = Object.keys(state.graph.references);
  $("category-list").replaceChildren(...categories.map(category => {
    const button = document.createElement("button");
    button.textContent = category.replace(/\b\w/g, c => c.toUpperCase());
    button.onclick = () => {
      referenceCategory = category;
      const kind = singularCategory(category);
      $("new-reference").textContent = `＋ New ${kind}`;
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
        $("reference-editor").hidden = true;
        $("reference-preview").hidden = false;
        $("reference-preview").innerHTML = `<div class="reference-empty"><p>This divider has no notes yet.</p><button data-empty-create> Create your first ${esc(kind)}</button></div>`;
        $("reference-preview").querySelector("[data-empty-create]").onclick = () => createReference(category);
        $("reference-fields").innerHTML = "";
        $("rename-reference").hidden = true;
        $("toggle-reference").hidden = true;
      }
    };
    return button;
  }));
  if (categories[0]) {
    const index = Math.max(0, categories.indexOf(referenceCategory));
    $("category-list").children[index].click();
  }
}

function bindReferenceLinks() {
  $("reference-preview").querySelectorAll("[data-project-link]").forEach(link => link.onclick = event => {
    event.preventDefault();
    const href = decodeURIComponent(link.dataset.projectLink.split("#")[0]).replace(/^\.\//, "");
    const base = referenceDoc.path.includes("/") ? referenceDoc.path.slice(0, referenceDoc.path.lastIndexOf("/") + 1) : "";
    const normalize = value => value.split("/").reduce((parts, part) => {
      if (!part || part === ".") return parts;
      if (part === "..") { parts.pop(); return parts; }
      parts.push(part); return parts;
    }, []).join("/");
    const candidates = [normalize(href), normalize(`${base}${href}`)];
    const target = state.graph.documents.find(doc => candidates.includes(doc.path) || doc.id === href);
    if (!target) { link.classList.add("broken-link"); link.title = "This project link could not be found"; return; }
    if (target.kind === "manuscript") selectManuscript(state.graph.manuscripts.findIndex(doc => doc.id === target.id));
    else selectReference(target);
  });
}

async function createReference(category = referenceCategory, { type = singularCategory(category).replace(" note", ""), openForEdit = true } = {}) {
  if (!category) return null;
  const dialog = $("reference-dialog"), form = $("reference-form");
  $("reference-dialog-title").textContent = `New ${type}`;
  $("reference-dialog-help").textContent = `Create a blank ${type} sheet and open it for editing.`;
  form.elements.name.value = "";
  const submitted = await new Promise(resolve => { dialog.onclose = () => resolve(dialog.returnValue === "default"); showDialog(dialog); form.elements.name.focus(); });
  if (!submitted) return null;
  const name = form.elements.name.value.trim();
  if (!name) return null;
  try {
    const result = await api("/api/references", { method:"POST", body:JSON.stringify({ category, type, title:name }) });
    state = result.snapshot;
    if (!openForEdit) return { name, id:result.created.id };
    referenceDoc = state.graph.documents.find(doc => doc.id === result.created.id) || null;
    render();
    if (referenceDoc) selectReference(referenceDoc);
    enterReferenceEdit();
    $("save-state").textContent = `${name} created`;
    return { name, id:result.created.id };
  } catch (error) { showError(error); return null; }
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
function openDrawer(title, html) { $("drawer-title").textContent = title; $("drawer-content").innerHTML = html; showDialog($("drawer-dialog")); }

$("manuscript-editor").addEventListener("input", event => {
  const words = event.target.value.trim().match(/\b[\w’'-]+\b/g) || [];
  $("word-count").textContent = `${words.length} words`;
  scheduleSave(event.target);
});

function enterReferenceEdit() {
  if (!referenceDoc || referenceEditing) return;
  const editor = $("reference-editor");
  referenceEditing = true;
  referenceOriginal = { body:editor.value, frontmatter:editor.dataset.frontmatter };
  editor.hidden = false;
  $("reference-preview").hidden = true;
  $("reference-fields").innerHTML = metadataMarkup(referenceDoc, true);
  bindMetadata($("reference-fields"), editor);
  $("toggle-reference").textContent = "Save";
  $("discard-reference").hidden = false;
  $("rename-reference").hidden = true;
  editor.focus();
}

$("toggle-reference").onclick = async () => {
  if (!referenceDoc) return;
  const editor = $("reference-editor");
  if (!referenceEditing) enterReferenceEdit();
  else {
    await saveEditor(editor);
    referenceEditing = false;
    const refreshed = state.graph.documents.find(doc => doc.id === referenceDoc.id);
    if (refreshed) selectReference(refreshed);
  }
};
$("discard-reference").onclick = () => {
  const editor = $("reference-editor");
  editor.value = referenceOriginal.body;
  editor.dataset.frontmatter = referenceOriginal.frontmatter;
  referenceEditing = false;
  selectReference(referenceDoc);
};

$("new-reference").onclick = () => createReference(referenceCategory);
$("rename-reference").onclick = async () => {
  if (!referenceDoc) return;
  const dialog = $("rename-reference-dialog"), form = $("rename-reference-form"), input = form.elements.name;
  const currentName = String(referenceDoc.frontmatter.name || referenceDoc.title);
  $("rename-reference-title").textContent = `Rename ${singularCategory(referenceDoc.category)}`;
  input.value = currentName;
  const updatePreview = async () => {
    const name = input.value.trim();
    if (!name || name === currentName) { $("rename-reference-preview").textContent = "Enter a new name to preview the change."; return; }
    try {
      const { plan } = await api("/api/references/rename", { method:"POST", body:JSON.stringify({ path:referenceDoc.path, name, dryRun:true }) });
      $("rename-reference-preview").innerHTML = `<strong>What will change</strong><span>Name: ${esc(plan.previousName)} → ${esc(plan.name)}</span><span>File: ${esc(plan.from)} → ${esc(plan.to)}</span><span>${plan.affectedPaths.length} linked document${plan.affectedPaths.length === 1 ? "" : "s"} will stay connected.</span>`;
    } catch (error) { $("rename-reference-preview").textContent = error.message; }
  };
  input.oninput = () => { clearTimeout(input._previewTimer); input._previewTimer = setTimeout(updatePreview, 180); };
  await updatePreview();
  const submitted = await new Promise(resolve => { dialog.onclose = () => resolve(dialog.returnValue === "default"); showDialog(dialog); input.focus(); input.select(); });
  if (!submitted || !input.value.trim() || input.value.trim() === currentName) return;
  try {
    const result = await api("/api/references/rename", { method:"POST", body:JSON.stringify({ path:referenceDoc.path, name:input.value.trim() }) });
    state = result.snapshot;
    referenceDoc = state.graph.documents.find(doc => doc.id === result.plan.id) || null;
    render();
  } catch (error) { showError(error); }
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

$("bookmark").onclick = async () => {
  const dialog = $("version-dialog"), form = $("version-form");
  form.elements.message.value = "";
  const submitted = await new Promise(resolve => { dialog.onclose = () => resolve(dialog.returnValue === "default"); showDialog(dialog); form.elements.message.focus(); });
  const message = submitted ? form.elements.message.value.trim() : "";
  if (message) { state.revision = await api("/api/revisions/bookmarks", { method:"POST", body:JSON.stringify({ message }) }); render(); $("save-state").textContent = "Version saved"; }
};
$("history").onclick = () => {
  openDrawer("Saved versions", state.revision.bookmarks.map(item => `<article class="history-card"><strong>${esc(item.message)}</strong><small>${esc(new Date(item.date).toLocaleString())}</small><button data-restore-bookmark="${esc(item.id)}">Return to this version</button></article>`).join("") || "<p>No saved versions yet. Save one before a major revision so you have a clear return point.</p>");
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
  $("recent-projects").innerHTML = library.recent.map(item => `<article class="recent-card"><div class="recent-details"><strong>${esc(item.name)}</strong><small title="${esc(item.root)}">${esc(item.root)}</small></div><div class="recent-actions"><button class="primary-action" data-open="${esc(item.root)}">Open</button><button class="quiet-action" data-forget="${esc(item.root)}" aria-label="Remove ${esc(item.name)} from recents">Remove from recents</button></div></article>`).join("") || "<p>No recent projects yet. Create a binder or open an existing folder.</p>";
  $("recent-projects").querySelectorAll("[data-open]").forEach(button => button.onclick = () => openProject(button.dataset.open));
  $("recent-projects").querySelectorAll("[data-forget]").forEach(button => button.onclick = async () => { if (!confirm("Remove this project from recents? Its files will stay on disk.")) return; await api("/api/library/recent", { method:"DELETE", body:JSON.stringify({ path:button.dataset.forget }) }); await renderLibrary(); });
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
$("project-library").onclick = async () => { await renderLibrary(); showDialog($("library-dialog")); };
$("open-project").onclick = async () => { const value = await promptFor("Absolute path to a Loom project"); if (value) await openProject(value); };
async function chooseProjectFolder() {
  const button = $("choose-project-folder");
  const parentInput = $("project-parent");
  const help = $("folder-picker-help");
  button.disabled = true;
  help.textContent = "Opening your folder selector…";
  try {
    const selected = await api("/api/system/select-folder", { method:"POST", headers:{ "content-type":"application/json", "x-loom-studio-request":"folder-picker" }, body:"{}" });
    if (selected.path) {
      parentInput.value = selected.path;
      help.textContent = "The new project will be created inside this folder.";
    } else help.textContent = "No folder selected. Choose one or enter its path.";
  } catch (error) {
    help.textContent = "The folder selector is unavailable. You can still enter the folder path.";
    showError(error);
  } finally { button.disabled = false; }
}
$("create-project").onclick = () => { showDialog($("create-dialog")); chooseProjectFolder(); };
$("choose-project-folder").onclick = chooseProjectFolder;
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
load().catch(async error => { showError(error); await renderLibrary(); showDialog($("library-dialog")); });
