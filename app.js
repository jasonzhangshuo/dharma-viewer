const CHAT_PROVIDERS = {
  codex: { label: "Codex", title: "Codex Chat", ask: "问 Codex", thinking: "已发送给 Codex，正在思考..." },
  hermes: { label: "Hermes", title: "Hermes Chat", ask: "问 Hermes", thinking: "已发送给 Hermes，正在思考..." },
  claude: { label: "Claude Code", title: "Claude Code Chat", ask: "问 Claude", thinking: "已发送给 Claude Code，正在思考..." },
  openclaw: { label: "OpenClaw", title: "OpenClaw Chat", ask: "问 OpenClaw", thinking: "已发送给 OpenClaw，正在思考..." },
};

const state = {
  data: null,
  activeDocId: null,
  lastHighlightId: null,
  selectedContexts: [],
  pendingSelection: null,
  agentSessionId: "",
  chatMessages: [],
  notes: [],
  noteDraft: null,
  editingNoteId: "",
  activeSidePanel: "chat",
  activeSourcePanel: "source",
  chatProvider: loadChatProvider(),
};

const STATIC_VIEWER = Boolean(window.DHARMA_STATIC_VIEWER);

const workspace = document.querySelector(".workspace");
const sourceContent = document.querySelector("#sourceContent");
const auxiliaryContent = document.querySelector("#auxiliaryContent");
const analysisContent = document.querySelector("#analysisContent");
const analysisSelect = document.querySelector("#analysisSelect");
const evidenceList = document.querySelector("#evidenceList");
const sourceSearch = document.querySelector("#sourceSearch");
const status = document.querySelector("#status");
const appTitle = document.querySelector("#appTitle");
const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const selectedContexts = document.querySelector("#selectedContexts");
const clearContexts = document.querySelector("#clearContexts");
const sendChat = document.querySelector("#sendChat");
const chatTitle = document.querySelector("#chatTitle");
const chatProviderSelect = document.querySelector("#chatProviderSelect");
const chatSessionBadge = document.querySelector("#chatSessionBadge");
const selectionToolbar = document.querySelector("#selectionToolbar");
const addContextFromSelection = document.querySelector("#addContextFromSelection");
const saveNoteFromSelection = document.querySelector("#saveNoteFromSelection");
const sourceTab = document.querySelector("#sourceTab");
const auxiliaryTab = document.querySelector("#auxiliaryTab");
const chatTab = document.querySelector("#chatTab");
const notesTab = document.querySelector("#notesTab");
const noteCount = document.querySelector("#noteCount");
const notesPanel = document.querySelector("#notesPanel");
const libraryLink = document.querySelector("#libraryLink");

init();

if (STATIC_VIEWER) {
  window.addEventListener("hashchange", () => init());
}

async function init() {
  try {
    if (libraryLink) libraryLink.href = STATIC_VIEWER ? "#library" : "/library";
    if (isLibraryRoute()) {
      await initLibrary();
      return;
    }

    workspace.className = "workspace";
    const response = await fetch(resolveDataUrl());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.activeDocId = state.data.analysis[0]?.id;
    appTitle.textContent = state.data.title;

    renderSource(state.data.sections);
    renderAuxiliaryMaterials(state.data.auxiliaryMaterials || []);
    renderAnalysisOptions(state.data.analysis);
    renderActiveAnalysis();
    renderSelectedContexts();
    renderChatSession();
    renderChatProvider();
    renderStaticMode();
    await loadNotes();
    renderSidePanel();

    status.textContent = `已读取：${state.data.materialDir}`;
  } catch (error) {
    status.textContent = `加载失败：${error instanceof Error ? error.message : "未知错误"}`;
  }
}

async function initLibrary() {
  const response = await fetch(STATIC_VIEWER ? "data/library.json" : "/api/library");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const library = await response.json();
  appTitle.textContent = "学习库";
  status.textContent = `已扫描：${library.viewerRoot}`;
  renderLibrary(library);
}

function isLibraryRoute() {
  if (STATIC_VIEWER) return !staticRoute().type || staticRoute().type === "library";
  return window.location.pathname === "/" || window.location.pathname === "/library";
}

function resolveDataUrl() {
  if (STATIC_VIEWER) {
    const route = staticRoute();
    if (route.type !== "view") return "data/demo.json";
    return `data/view/${encodeURIComponent(route.workspace)}/${encodeURIComponent(route.runId)}.json`;
  }
  const match = window.location.pathname.match(/^\/view\/([^/]+)\/([^/]+)$/);
  if (!match) return "/api/demo";
  return `/api/view/${match[1]}/${match[2]}`;
}

function staticRoute() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
  if (!hash || hash === "library") return { type: "library" };
  const match = hash.match(/^view\/([^/]+)\/([^/]+)$/);
  if (!match) return { type: "library" };
  return { type: "view", workspace: match[1], runId: match[2] };
}

function renderLibrary(library) {
  const items = Array.isArray(library.workspaces) ? library.workspaces : [];
  workspace.className = "library-workspace";
  workspace.innerHTML = `
    <section class="library-hero">
      <p class="pane-kicker">已发布课程</p>
      <h2>从这里回到任意一课的学习现场</h2>
      <p>每个课程入口会打开最新发布的分析页；历史分析和我的笔记仍按 workspace 保存在本地。</p>
    </section>
    ${
      items.length
        ? `<section class="library-grid">${items.map((item) => renderLibraryCard(item)).join("")}</section>`
        : `<section class="library-empty">
            <h2>还没有发布过的课程</h2>
            <p>先发布一次 viewer run，这里就会出现课程入口。</p>
          </section>`
    }
  `;
}

function renderLibraryCard(item) {
  return `
    <article class="library-card">
      <div class="library-card-main">
        <p class="pane-kicker">${escapeHtml(item.workspace)}</p>
        <h2>${escapeHtml(item.title || item.workspace)}</h2>
        <p>${item.sourcePath ? escapeHtml(item.sourcePath) : "暂无 source 路径"}</p>
      </div>
      <div class="library-stats">
        <span><strong>${Number(item.runCount || 0)}</strong> 分析</span>
        <span><strong>${Number(item.noteCount || 0)}</strong> 笔记</span>
        <span>${formatDateTime(item.updatedAt) || "时间未知"}</span>
      </div>
      <a class="library-open" href="${escapeHtml(STATIC_VIEWER ? staticViewHref(item.workspace, item.latestRunId || "latest") : item.latestUrl)}">打开最新学习页</a>
    </article>
  `;
}

function staticViewHref(workspace, runId) {
  return `#view/${encodeURIComponent(workspace)}/${encodeURIComponent(runId || "latest")}`;
}

analysisSelect.addEventListener("change", () => {
  state.activeDocId = analysisSelect.value;
  renderActiveAnalysis();
});

chatProviderSelect.addEventListener("change", () => {
  const nextProvider = normalizeChatProvider(chatProviderSelect.value);
  if (nextProvider === state.chatProvider) return;
  state.chatProvider = nextProvider;
  state.agentSessionId = "";
  localStorage.setItem("dharma-chat-provider", state.chatProvider);
  renderChatProvider();
  renderChatSession();
  appendChatMessage("system", `已切换到 ${providerLabel()}，将从新会话开始。`);
});

sourceSearch.addEventListener("input", () => {
  const query = sourceSearch.value.trim();
  document.querySelectorAll(".paragraph").forEach((element) => {
    element.classList.toggle("is-search-hit", Boolean(query) && element.textContent.includes(query));
  });
});

document.addEventListener("selectionchange", captureReadableSelection);

selectionToolbar.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

addContextFromSelection.addEventListener("click", () => {
  if (!state.pendingSelection) return;
  addSelectedContext(state.pendingSelection);
  selectionToolbar.hidden = true;
  window.getSelection()?.removeAllRanges();
});

saveNoteFromSelection.addEventListener("click", async () => {
  if (!state.pendingSelection) return;
  openNoteDraft({
    kind: state.pendingSelection.kind,
    text: state.pendingSelection.text,
    quote: state.pendingSelection.text,
  });
  selectionToolbar.hidden = true;
  window.getSelection()?.removeAllRanges();
});

sourceTab.addEventListener("click", () => switchSourcePanel("source"));
auxiliaryTab.addEventListener("click", () => switchSourcePanel("auxiliary"));
chatTab.addEventListener("click", () => switchSidePanel("chat"));
notesTab.addEventListener("click", () => switchSidePanel("notes"));

clearContexts.addEventListener("click", () => {
  state.selectedContexts = [];
  renderSelectedContexts();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitChat();
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  chatForm.requestSubmit();
});

function renderSource(sections) {
  sourceContent.innerHTML = sections
    .map(
      (section) => `
        <section class="source-section" id="${section.id}">
          <div class="section-title">${escapeHtml(section.title)}</div>
          ${section.paragraphs
            .map(
              (paragraph) => `
                <p class="paragraph" id="${paragraph.id}" data-page-label="${formatPageLabel(
                  paragraph.pageNumbers ?? [paragraph.pageNumber]
                )}" data-raw-text="${escapeHtml(paragraph.text)}" title="原 PDF：${formatPageLabel(paragraph.pageNumbers ?? [paragraph.pageNumber])}">
                  <span class="source-text">${formatSourceParagraph(paragraph.text)}</span>
                </p>
              `
            )
            .join("")}
        </section>
      `
    )
    .join("");
}

function renderAuxiliaryMaterials(materials) {
  if (!materials.length) {
    auxiliaryContent.innerHTML = `<div class="auxiliary-empty">暂无可展示的辅助材料。</div>`;
    return;
  }

  auxiliaryContent.innerHTML = materials
    .map(
      (item) => `
        <article class="auxiliary-card">
          <div class="auxiliary-heading">
            <h3>${escapeHtml(item.title || "辅助材料")}</h3>
            ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
          </div>
          <div class="auxiliary-text">${renderAuxiliaryBlocks(item.blocks || [], item.content || "")}</div>
        </article>
      `
    )
    .join("");
}

function renderAuxiliaryBlocks(blocks, fallbackContent) {
  if (!blocks.length) return renderPlainText(fallbackContent);

  return blocks
    .map(
      (block) => `
        <section class="auxiliary-block auxiliary-block-${escapeHtml(block.key || "content")}">
          <div class="auxiliary-block-title">${escapeHtml(block.title || "内容")}</div>
          <div class="auxiliary-block-items">
            ${(block.items || []).map(renderAuxiliaryItem).join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderAuxiliaryItem(item) {
  const parsed = parseNumberedLine(item.text || "");
  return `
    <div class="auxiliary-item${parsed.number ? " has-number" : ""}">
      ${parsed.number ? `<span class="auxiliary-item-number">${escapeHtml(parsed.number)}</span>` : ""}
      <span>${linkifyPlainText(parsed.text)}</span>
    </div>
  `;
}

function renderAnalysisOptions(docs) {
  analysisSelect.innerHTML = docs
    .map((doc) => `<option value="${doc.id}">${escapeHtml(doc.title)}</option>`)
    .join("");
}

function renderActiveAnalysis() {
  const doc = state.data.analysis.find((item) => item.id === state.activeDocId);
  if (!doc) return;

  analysisSelect.value = doc.id;
  evidenceList.innerHTML = renderEvidenceButtons(doc.evidence);
  const markdownVariant = isStudyMapV2(doc) ? "study-map-v2" : "";
  analysisContent.classList.toggle("study-map-v2", markdownVariant === "study-map-v2");
  analysisContent.innerHTML = `${renderStructuredViews(doc.views || [])}${renderMarkdown(doc.markdown, doc.evidence, {
    variant: markdownVariant,
  })}`;

  evidenceList.querySelectorAll("button[data-target]").forEach((button) => {
    button.addEventListener("click", () => highlightEvidence(button.dataset.target, button.dataset.quote));
  });

  analysisContent.querySelectorAll("button[data-target]").forEach((button) => {
    button.addEventListener("click", () => highlightEvidence(button.dataset.target, button.dataset.quote));
  });
}

function isStudyMapV2(doc) {
  return doc.id === "02-study-map-v2" || doc.title?.includes("dharma-fudao-fast V2") || doc.markdown?.includes("辅导员带班总判断");
}

function captureReadableSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    selectionToolbar.hidden = true;
    return;
  }

  const text = selection.toString().trim().replace(/\s+/g, " ");
  if (text.length < 2) {
    selectionToolbar.hidden = true;
    return;
  }

  const range = selection.rangeCount ? selection.getRangeAt(0) : null;
  if (!range) return;
  const sourceElement = closestWithin(range.commonAncestorContainer, sourceContent) || closestWithin(range.commonAncestorContainer, auxiliaryContent);
  const analysisElement = closestWithin(range.commonAncestorContainer, analysisContent);
  const chatElement = closestWithin(range.commonAncestorContainer, chatMessages);
  if (!sourceElement && !analysisElement && !chatElement) {
    selectionToolbar.hidden = true;
    return;
  }

  state.pendingSelection = {
    kind: sourceElement ? "source" : analysisElement ? "analysis" : "chat",
    text: text.slice(0, 1600),
  };

  const rect = range.getBoundingClientRect();
  selectionToolbar.style.left = `${Math.min(window.innerWidth - 120, Math.max(12, rect.left + rect.width / 2 - 48))}px`;
  selectionToolbar.style.top = `${Math.max(12, rect.top - 42)}px`;
  selectionToolbar.hidden = false;
}

function closestWithin(node, root) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element && root.contains(element) ? element : null;
}

function addSelectedContext(context) {
  state.selectedContexts = [
    ...state.selectedContexts,
    {
      id: `ctx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: context.kind,
      text: context.text,
    },
  ].slice(-6);
  renderSelectedContexts();
  chatInput.focus();
}

function renderSelectedContexts() {
  if (!state.selectedContexts.length) {
    selectedContexts.innerHTML = "";
    clearContexts.disabled = true;
    return;
  }

  clearContexts.disabled = false;
  selectedContexts.innerHTML = state.selectedContexts
    .map(
      (item) => `
        <div class="context-chip">
          <span>${renderContextKind(item.kind)}</span>
          <button type="button" data-context-id="${escapeHtml(item.id)}" aria-label="移除引用">×</button>
          <p>${escapeHtml(compactText(item.text, 54))}</p>
        </div>
      `
    )
    .join("");

  selectedContexts.querySelectorAll("button[data-context-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedContexts = state.selectedContexts.filter((item) => item.id !== button.dataset.contextId);
      renderSelectedContexts();
    });
  });
}

async function submitChat() {
  if (STATIC_VIEWER) {
    appendChatMessage("system", "GitHub 静态版只支持阅读，不支持在线问答。");
    return;
  }

  const question = chatInput.value.trim();
  if (!question) return;
  const submittedContexts = state.selectedContexts.map(({ kind, text }) => ({ kind, text }));
  const providerAtSubmit = state.chatProvider;

  appendChatMessage("user", question, submittedContexts);
  const pendingMessageId = appendChatMessage("assistant", "", [], { status: "thinking", providerLabel: providerLabel(providerAtSubmit) });
  chatInput.value = "";
  state.selectedContexts = [];
  renderSelectedContexts();
  setChatBusy(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question,
        contexts: submittedContexts,
        agentSessionId: state.agentSessionId,
        provider: providerAtSubmit,
        workspace: currentWorkspace(),
        title: state.data?.title || "",
        sourcePath: currentSourcePath(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

    state.agentSessionId = payload.agentSessionId || payload.hermesSessionId || state.agentSessionId;
    renderChatSession();
    updateChatMessage(pendingMessageId, {
      text: payload.answer || `${payload.providerLabel || providerLabel(providerAtSubmit)} 没有返回可显示内容。`,
      evidence: payload.answerEvidence || [],
      providerLabel: payload.providerLabel || providerLabel(providerAtSubmit),
      status: "done",
    });

    if (payload.analysisDoc) {
      state.data.analysis = [payload.analysisDoc, ...state.data.analysis.filter((item) => item.id !== payload.analysisDoc.id)];
      state.activeDocId = payload.analysisDoc.id;
      renderAnalysisOptions(state.data.analysis);
      renderActiveAnalysis();
      appendChatMessage("system", `已更新中间展示：${payload.analysisDoc.title}`);
    }
  } catch (error) {
    updateChatMessage(pendingMessageId, {
      role: "system",
      text: `调用 ${providerLabel(providerAtSubmit)} 失败：${error instanceof Error ? error.message : "未知错误"}`,
      status: "done",
    });
  } finally {
    setChatBusy(false);
  }
}

function appendChatMessage(role, text, contexts = [], meta = {}) {
  const message = {
    id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    contexts,
    evidence: meta.evidence || [],
    status: meta.status || "done",
    providerLabel: meta.providerLabel || providerLabel(),
  };
  state.chatMessages.push(message);
  renderChatMessages();
  return message.id;
}

function updateChatMessage(id, patch) {
  state.chatMessages = state.chatMessages.map((message) => (message.id === id ? { ...message, ...patch } : message));
  renderChatMessages();
}

function renderChatMessages() {
  if (!state.chatMessages.length) {
    chatMessages.innerHTML = `<div class="chat-empty">划选左侧原文或中间分析后加入提问。</div>`;
    return;
  }

  chatMessages.innerHTML = state.chatMessages
    .map(
      (message) => `
        <div class="chat-message ${message.role}">
          <div class="message-role">${renderRole(message.role, message)}</div>
          ${message.contexts?.length ? renderMessageContexts(message.contexts) : ""}
          ${
            message.status === "thinking"
              ? renderThinkingMessage(message)
              : `<div class="message-text">${renderMessageText(message)}</div>
                 ${message.role === "assistant" ? `<button class="message-save" type="button" data-message-note="${escapeHtml(message.id)}">收藏回答</button>` : ""}`
          }
        </div>
      `
    )
    .join("");
  chatMessages.querySelectorAll("button[data-message-note]").forEach((button) => {
    button.addEventListener("click", async () => {
      const message = state.chatMessages.find((item) => item.id === button.dataset.messageNote);
      if (!message) return;
      await saveNote({ kind: "chat", text: message.text });
    });
  });
  chatMessages.querySelectorAll("button[data-target]").forEach((button) => {
    button.addEventListener("click", () => highlightEvidence(button.dataset.target, button.dataset.quote));
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderThinkingMessage(message) {
  return `
    <div class="typing-indicator" aria-live="polite">
      <span></span>
      <span></span>
      <span></span>
      <em>${escapeHtml(providerConfig(providerKeyFromLabel(message?.providerLabel)).thinking)}</em>
    </div>
  `;
}

function renderMessageContexts(contexts) {
  return `
    <div class="message-contexts">
      ${contexts
        .map((item) => `<span>${renderContextKind(item.kind)}：${escapeHtml(compactText(item.text, 32))}</span>`)
        .join("")}
    </div>
  `;
}

function renderMessageText(message) {
  return message.role === "assistant" ? renderMarkdown(message.text, message.evidence || []) : renderPlainText(message.text);
}

function renderRole(role, message = null) {
  if (role === "assistant") return escapeHtml(message?.providerLabel || providerLabel());
  if (role === "system") return "系统";
  return "我";
}

function renderChatProvider() {
  chatProviderSelect.value = state.chatProvider;
  chatTitle.textContent = providerConfig().title;
  chatTab.textContent = providerConfig().ask;
  chatInput.placeholder = `${providerConfig().ask}...`;
}

function renderStaticMode() {
  if (!STATIC_VIEWER) return;
  chatProviderSelect.disabled = true;
  chatInput.disabled = true;
  sendChat.disabled = true;
  chatInput.placeholder = "静态版不支持在线问答";
  chatSessionBadge.textContent = "静态";
}

function providerConfig(provider = state.chatProvider) {
  return CHAT_PROVIDERS[normalizeChatProvider(provider)] || CHAT_PROVIDERS.codex;
}

function providerLabel(provider = state.chatProvider) {
  return providerConfig(provider).label;
}

function providerKeyFromLabel(label) {
  const found = Object.entries(CHAT_PROVIDERS).find(([, item]) => item.label === label);
  return found ? found[0] : state.chatProvider;
}

function normalizeChatProvider(provider) {
  return CHAT_PROVIDERS[String(provider || "").trim().toLowerCase()] ? String(provider || "").trim().toLowerCase() : "codex";
}

function loadChatProvider() {
  try {
    return normalizeChatProvider(localStorage.getItem("dharma-chat-provider"));
  } catch {
    return "codex";
  }
}

function renderContextKind(kind) {
  if (kind === "analysis") return "分析";
  if (kind === "chat") return "回答";
  if (kind === "reflection") return "感受";
  return "原文";
}

function setChatBusy(isBusy) {
  sendChat.disabled = isBusy;
  chatInput.disabled = isBusy;
  sendChat.textContent = isBusy ? "思考中" : "发送";
}

function renderChatSession() {
  chatSessionBadge.textContent = state.agentSessionId ? `Session ${state.agentSessionId.slice(-6)}` : "新会话";
}

async function loadNotes() {
  if (STATIC_VIEWER) {
    state.notes = [];
    renderNotes();
    return;
  }

  try {
    const response = await fetch(notesApiUrl());
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    state.notes = Array.isArray(payload.notes) ? payload.notes : [];
  } catch (error) {
    state.notes = [];
    appendChatMessage("system", `加载笔记失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
  renderNotes();
}

async function saveNote(note) {
  if (STATIC_VIEWER) {
    appendChatMessage("system", "GitHub 静态版不支持保存笔记。");
    return;
  }

  const payload = {
    ...note,
    originRunId: state.data?.run?.runId || resolveRouteRunId(),
    originDocId: state.activeDocId || "",
    originTitle: activeAnalysisTitle(),
    sourcePath: currentSourcePath(),
  };

  try {
    const response = await fetch(notesApiUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
    state.notes = [result.note, ...state.notes.filter((item) => item.id !== result.note.id)];
    renderNotes();
  } catch (error) {
    appendChatMessage("system", `保存笔记失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
}

async function deleteNote(noteId) {
  if (STATIC_VIEWER) {
    appendChatMessage("system", "GitHub 静态版不支持删除笔记。");
    return;
  }

  try {
    const response = await fetch(`${notesApiUrl()}/${encodeURIComponent(noteId)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
    state.notes = state.notes.filter((item) => item.id !== noteId);
    renderNotes();
  } catch (error) {
    appendChatMessage("system", `删除笔记失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
}

async function updateNoteComment(noteId, comment) {
  if (STATIC_VIEWER) {
    appendChatMessage("system", "GitHub 静态版不支持更新笔记。");
    return;
  }

  try {
    const response = await fetch(`${notesApiUrl()}/${encodeURIComponent(noteId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
    state.notes = state.notes.map((item) => (item.id === result.note.id ? result.note : item));
    state.editingNoteId = "";
    renderNotes();
  } catch (error) {
    appendChatMessage("system", `保存感受失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
}

function renderSidePanel() {
  const isNotes = state.activeSidePanel === "notes";
  chatTab.classList.toggle("is-active", !isNotes);
  notesTab.classList.toggle("is-active", isNotes);
  chatMessages.hidden = isNotes;
  chatForm.hidden = isNotes;
  notesPanel.hidden = !isNotes;
}

function switchSourcePanel(panel) {
  state.activeSourcePanel = panel;
  const isAuxiliary = panel === "auxiliary";
  sourceTab.classList.toggle("is-active", !isAuxiliary);
  auxiliaryTab.classList.toggle("is-active", isAuxiliary);
  sourceContent.hidden = isAuxiliary;
  auxiliaryContent.hidden = !isAuxiliary;
  sourceSearch.disabled = isAuxiliary;
}

function switchSidePanel(panel) {
  state.activeSidePanel = panel;
  renderSidePanel();
}

function renderNotes() {
  noteCount.textContent = String(state.notes.length);
  const composer = renderNoteComposer();

  if (!state.notes.length) {
    notesPanel.innerHTML = `${composer}<div class="notes-empty">还没有收藏。可以直接写一条感受，也可以划选原文、分析或回答后收藏。</div>`;
    bindNotePanelActions();
    return;
  }

  notesPanel.innerHTML =
    composer +
    state.notes
      .map(
        (note) => `
        <article class="note-card">
          <div class="note-meta">
            <span>${renderNoteKind(note.kind)}</span>
            <time>${formatDateTime(note.createdAt)}</time>
          </div>
          <p class="note-text">${escapeHtml(note.text)}</p>
          ${note.comment ? `<div class="note-comment"><strong>我的感受</strong><p>${escapeHtml(note.comment)}</p></div>` : ""}
          ${note.originTitle ? `<div class="note-origin">${escapeHtml(note.originTitle)}</div>` : ""}
          ${state.editingNoteId === note.id ? renderNoteCommentEditor(note) : ""}
          <div class="note-actions">
            <button type="button" data-note-context="${escapeHtml(note.id)}">加入提问</button>
            ${note.kind === "source" || note.kind === "analysis" ? `<button type="button" data-note-locate="${escapeHtml(note.id)}">定位原文</button>` : ""}
            <button type="button" data-note-comment="${escapeHtml(note.id)}">${note.comment ? "修改感受" : "补充感受"}</button>
            <button type="button" data-note-delete="${escapeHtml(note.id)}">删除</button>
          </div>
        </article>
      `
      )
      .join("");

  bindNotePanelActions();
}

function renderNoteCommentEditor(note) {
  return `
    <form class="note-comment-editor" data-note-comment-form="${escapeHtml(note.id)}">
      <textarea rows="4" aria-label="补充我的感受">${escapeHtml(note.comment || "")}</textarea>
      <div class="note-composer-actions">
        <button class="secondary-button" type="button" data-note-comment-cancel="${escapeHtml(note.id)}">取消</button>
        <button class="primary-button" type="submit">保存感受</button>
      </div>
    </form>
  `;
}

function renderNoteComposer() {
  const draft = state.noteDraft;
  return `
    <form id="noteComposer" class="note-composer">
      ${draft ? `<div class="note-draft">
        <span>${renderNoteKind(draft.kind)}</span>
        <p>${escapeHtml(compactText(draft.text, 120))}</p>
      </div>` : ""}
      <textarea id="noteCommentInput" rows="4" placeholder="${
        draft ? "写下这段摘录给你的提醒、触动或行动..." : "直接写一条自己的感受..."
      }" aria-label="写笔记">${draft?.comment ? escapeHtml(draft.comment) : ""}</textarea>
      <div class="note-composer-actions">
        ${draft ? `<button id="cancelNoteDraft" class="secondary-button" type="button">取消摘录</button>` : "<span></span>"}
        <button id="saveNoteDraft" class="primary-button" type="submit">${draft ? "保存完整笔记" : "保存感受"}</button>
      </div>
    </form>
  `;
}

function bindNotePanelActions() {
  const noteComposer = document.querySelector("#noteComposer");
  noteComposer?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveNoteDraft();
  });

  document.querySelector("#cancelNoteDraft")?.addEventListener("click", () => {
    state.noteDraft = null;
    renderNotes();
  });

  notesPanel.querySelectorAll("button[data-note-context]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = state.notes.find((item) => item.id === button.dataset.noteContext);
      if (!note) return;
      addSelectedContext({ kind: note.kind, text: noteContextText(note) });
      switchSidePanel("chat");
    });
  });

  notesPanel.querySelectorAll("button[data-note-locate]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = state.notes.find((item) => item.id === button.dataset.noteLocate);
      const match = note ? findParagraphForText(note.quote || note.text) : null;
      if (match) highlightEvidence(match.id, note.quote || note.text);
    });
  });

  notesPanel.querySelectorAll("button[data-note-comment]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingNoteId = button.dataset.noteComment || "";
      renderNotes();
      notesPanel.querySelector(`form[data-note-comment-form="${cssEscape(state.editingNoteId)}"] textarea`)?.focus();
    });
  });

  notesPanel.querySelectorAll("button[data-note-comment-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.editingNoteId === button.dataset.noteCommentCancel) state.editingNoteId = "";
      renderNotes();
    });
  });

  notesPanel.querySelectorAll("form[data-note-comment-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const noteId = form.dataset.noteCommentForm;
      const comment = form.querySelector("textarea")?.value.trim() || "";
      await updateNoteComment(noteId, comment);
    });
  });

  notesPanel.querySelectorAll("button[data-note-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteNote(button.dataset.noteDelete));
  });
}

function openNoteDraft(draft) {
  state.noteDraft = draft;
  switchSidePanel("notes");
  renderNotes();
  document.querySelector("#noteCommentInput")?.focus();
}

async function saveNoteDraft() {
  const comment = document.querySelector("#noteCommentInput")?.value.trim() || "";
  const draft = state.noteDraft;

  if (!draft && !comment) return;

  await saveNote(
    draft
      ? {
          ...draft,
          comment,
        }
      : {
          kind: "reflection",
          text: comment,
        }
  );
  state.noteDraft = null;
  renderNotes();
}

function notesApiUrl() {
  return `/api/view/${encodeURIComponent(currentWorkspace())}/notes`;
}

function currentWorkspace() {
  return state.data?.run?.workspace || state.data?.workspace || state.data?.materialDir || state.data?.title || "demo";
}

function currentSourcePath() {
  return state.data?.run?.source?.path || state.data?.sourcePath || "";
}

function activeAnalysisTitle() {
  return state.data?.analysis?.find((item) => item.id === state.activeDocId)?.title || "";
}

function resolveRouteRunId() {
  const match = window.location.pathname.match(/^\/view\/[^/]+\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function noteContextText(note) {
  return note.comment ? `${note.text}\n\n我的感受：${note.comment}` : note.text;
}

function renderEvidenceButtons(evidence) {
  const topEvidence = evidence
    .filter((item) => item.match)
    .filter(uniqueEvidence)
    .filter((item) => item.snippet.length >= 10)
    .slice(0, 12);

  if (topEvidence.length === 0) {
    return `<span class="empty">暂无可定位原文</span>`;
  }

  return topEvidence
    .map((item) => {
      return `<button class="evidence-button" type="button" data-target="${escapeHtml(item.match.paragraphId)}" data-quote="${escapeHtml(
        item.match.matchedText ?? item.snippet
      )}" title="${formatPageLabel(item.match.pageNumbers ?? [item.match.pageNumber])}">${escapeHtml(compact(item.snippet))}</button>`;
    })
    .join("");
}

function uniqueEvidence(item, index, items) {
  const key = evidenceKey(item);
  return items.findIndex((candidate) => evidenceKey(candidate) === key) === index;
}

function evidenceKey(item) {
  return item.match?.paragraphId || item.snippet;
}

function renderStructuredViews(views) {
  return views.map((view) => renderStructuredView(view)).join("");
}

function renderStructuredView(view) {
  switch (view.type) {
    case "framework-diagram":
      return renderFrameworkDiagram(view);
    case "comparison-table":
      return renderComparisonTable(view);
    case "ladder":
      return renderLadder(view);
    default:
      return "";
  }
}

function renderFrameworkDiagram(view) {
  const nodes = view.nodes || [];
  const byPosition = groupBy(nodes, (node) => node.position || "center");

  return `
    <section class="visual-block framework-diagram">
      <div class="visual-heading">
        <h2>${escapeHtml(view.title || "结构图")}</h2>
        ${view.subtitle ? `<p>${escapeHtml(view.subtitle)}</p>` : ""}
      </div>
      <div class="diagram-canvas">
        ${renderNodeRow(byPosition.top, "diagram-row single")}
        <div class="diagram-axis">${escapeHtml(view.axisLabel || "")}</div>
        <div class="diagram-split">
          <div>${renderNodeStack(byPosition.left)}</div>
          <div class="diagram-line" aria-hidden="true"></div>
          <div>${renderNodeStack(byPosition.right)}</div>
        </div>
        ${renderNodeRow(byPosition.center, "diagram-row center")}
        <div class="diagram-branch">
          ${renderNodeStack([...(byPosition["split-left"] || []), ...(byPosition["bottom-left"] || [])])}
          ${renderNodeStack([...(byPosition["split-right"] || []), ...(byPosition["bottom-right"] || [])])}
        </div>
        ${renderNodeRow(byPosition.bottom, "diagram-row final")}
      </div>
    </section>
  `;
}

function renderNodeRow(nodes = [], className) {
  if (!nodes.length) return "";
  return `<div class="${className}">${nodes.map((node) => renderVisualCard(node)).join("")}</div>`;
}

function renderNodeStack(nodes = []) {
  return `<div class="diagram-stack">${nodes.map((node) => renderVisualCard(node)).join("")}</div>`;
}

function renderVisualCard(item) {
  const attrs = matchAttrs(item);
  const tag = attrs ? "button" : "div";
  const subtitle = item.subtitle || item.summary || item.description || item.desc || "";
  return `
    <${tag} class="visual-card tone-${escapeHtml(item.tone || "neutral")}" ${attrs || ""}>
      <strong>${escapeHtml(item.label || item.title || "")}</strong>
      ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
    </${tag}>
  `;
}

function renderLadder(view) {
  return `
    <section class="visual-block ladder-view">
      <div class="visual-heading">
        <h2>${escapeHtml(view.title || "层级图")}</h2>
        ${view.subtitle ? `<p>${escapeHtml(view.subtitle)}</p>` : ""}
      </div>
      <div class="ladder-steps">
        ${(view.steps || view.nodes || []).map((step, index) => renderLadderStep(step, index)).join("")}
      </div>
    </section>
  `;
}

function renderLadderStep(step, index) {
  const attrs = matchAttrs(step);
  const tag = attrs ? "button" : "div";
  const label = step.label || step.title || step.name || "";
  const subtitle = step.subtitle || step.summary || step.description || ladderStepDetails(step);
  return `
    <${tag} class="ladder-step tone-${escapeHtml(step.tone || "neutral")}" ${attrs || ""}>
      <span class="step-number">${index + 1}</span>
      <strong>${escapeHtml(label)}</strong>
      ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
    </${tag}>
  `;
}

function ladderStepDetails(step) {
  return [step.content, step.practice].filter((item) => typeof item === "string" && item.trim()).join("；");
}

function renderComparisonTable(view) {
  const columns = view.columns || [];
  return `
    <section class="visual-block comparison-view">
      <div class="visual-heading">
        <h2>${escapeHtml(view.title || "比较表")}</h2>
        ${view.subtitle ? `<p>${escapeHtml(view.subtitle)}</p>` : ""}
      </div>
      <div class="comparison-table">
        <div class="comparison-row header" style="${comparisonGridStyle(columns.length)}">
          <div>${escapeHtml(view.rowLabel || "")}</div>
          ${columns.map((column) => `<div>${escapeHtml(column)}</div>`).join("")}
        </div>
        ${(view.rows || []).map((row) => renderComparisonRow(row, columns.length)).join("")}
      </div>
    </section>
  `;
}

function renderComparisonRow(row, columnCount) {
  const cells = row.cells || [];
  return `
    <div class="comparison-row" style="${comparisonGridStyle(columnCount)}">
      <div class="row-label">${escapeHtml(row.label || "")}</div>
      ${cells.map((cell) => renderComparisonCell(cell)).join("")}
    </div>
  `;
}

function comparisonGridStyle(columnCount) {
  return `grid-template-columns:minmax(82px,0.7fr) repeat(${columnCount}, minmax(110px,1fr))`;
}

function renderComparisonCell(cell) {
  const value = typeof cell === "string" ? { text: cell } : cell;
  const attrs = matchAttrs(value);
  const tag = attrs ? "button" : "div";
  return `<${tag} class="comparison-cell tone-${escapeHtml(value.tone || "neutral")}" ${attrs || ""}>${escapeHtml(value.text || "")}</${tag}>`;
}

function matchAttrs(item) {
  if (!item?.match) return "";
  return `type="button" data-target="${escapeHtml(item.match.paragraphId)}" data-quote="${escapeHtml(
    item.match.matchedText || item.quote || ""
  )}" title="${formatPageLabel(item.match.pageNumbers ?? [item.match.pageNumber])}"`;
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function renderMarkdown(markdown, evidence, options = {}) {
  const evidenceBySnippet = new Map(
    evidence
      .filter((item) => item.match)
      .map((item) => [item.snippet, { paragraphId: item.match.paragraphId, quote: item.match.matchedText ?? item.snippet }])
  );

  const isStudyMapV2 = options.variant === "study-map-v2";
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let listType = null;
  let sectionOpen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      closeSection();
      html.push(isStudyMapV2 ? `<header class="study-map-cover"><h1>${inline(line.slice(2), evidenceBySnippet)}</h1></header>` : `<h1>${inline(line.slice(2), evidenceBySnippet)}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      if (isStudyMapV2) {
        closeSection();
        const heading = line.slice(3);
        const parsed = heading.match(/^(\d+)[.．]\s*(.+)$/);
        html.push(`<section class="analysis-section"><h2>${parsed ? `<span class="section-index">${escapeHtml(parsed[1])}</span><span>${inline(parsed[2], evidenceBySnippet)}</span>` : inline(heading, evidenceBySnippet)}</h2>`);
        sectionOpen = true;
      } else {
        html.push(`<h2>${inline(line.slice(3), evidenceBySnippet)}</h2>`);
      }
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inline(line.slice(4), evidenceBySnippet)}</h3>`);
      continue;
    }

    if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${inline(line.slice(2), evidenceBySnippet)}</blockquote>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      openList("ol");
      html.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""), evidenceBySnippet)}</li>`);
      continue;
    }

    if (line.startsWith("- ")) {
      openList("ul");
      html.push(`<li>${inline(line.slice(2), evidenceBySnippet)}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(line, evidenceBySnippet)}</p>`);
  }

  closeList();
  closeSection();
  return html.join("");

  function openList(type) {
    if (listType === type) return;
    closeList();
    html.push(`<${type}>`);
    listType = type;
  }

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  }

  function closeSection() {
    if (!sectionOpen) return;
    closeList();
    html.push("</section>");
    sectionOpen = false;
  }
}

function inline(value, evidenceBySnippet) {
  let rendered = escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  for (const [snippet, match] of evidenceBySnippet) {
    const escapedSnippet = escapeHtml(snippet);
    if (!rendered.includes(escapedSnippet)) continue;
    const button = `<button class="evidence-button" type="button" data-target="${escapeHtml(match.paragraphId)}" data-quote="${escapeHtml(
      match.quote
    )}">${escapedSnippet}</button>`;
    rendered = rendered.replaceAll(escapedSnippet, button);
  }

  return rendered;
}

function highlightEvidence(paragraphId, quote) {
  const target = document.getElementById(paragraphId);
  if (!target) return;

  if (state.lastHighlightId) {
    clearHighlight(document.getElementById(state.lastHighlightId));
  }

  target.classList.add("is-highlighted");
  markQuote(target, quote);
  state.lastHighlightId = paragraphId;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearHighlight(target) {
  if (!target) return;
  const sourceText = target.querySelector(".source-text");
  if (sourceText) sourceText.innerHTML = formatSourceParagraph(target.dataset.rawText ?? sourceText.textContent);
  target.classList.remove("is-highlighted");
}

function markQuote(target, quote) {
  const sourceText = target.querySelector(".source-text");
  if (!sourceText) return;

  const text = target.dataset.rawText ?? sourceText.textContent;
  const exact = quote && text.includes(quote) ? quote : "";
  if (!exact) {
    sourceText.textContent = text;
    return;
  }

  const start = text.indexOf(exact);
  const before = text.slice(0, start);
  const after = text.slice(start + exact.length);
  sourceText.innerHTML = `${escapeHtml(before)}<mark>${escapeHtml(exact)}</mark>${escapeHtml(after)}`;
}

function formatSourceParagraph(text) {
  const subheading = text.match(
    /^(\d+．(?:立足于世间哲学|立足于对神的信仰|立足于人性论和因果观|对永恒问题的追求|对完善人格的追求|对文化艺术的追求|以缘起法审时度势|从缘起法认识空性|有我之爱是有限的|无我才能慈悲大爱|死亡并不是结束|临终关怀))(.+)$/
  );

  if (!subheading) return escapeHtml(text);
  return `<strong class="source-subheading">${escapeHtml(subheading[1])}</strong>${escapeHtml(subheading[2])}`;
}

function compact(value) {
  return value.length > 34 ? `${value.slice(0, 33)}...` : value;
}

function compactText(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function renderPlainText(value) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function parseNumberedLine(value) {
  const match = String(value ?? "").match(/^([0-9]+)[.．]\s*(.+)$/);
  if (!match) return { number: "", text: value };
  return { number: match[1], text: match[2] };
}

function linkifyPlainText(value) {
  return escapeHtml(value).replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>`
  );
}

function formatPageLabel(pageNumbers) {
  const unique = [...new Set(pageNumbers)].sort((a, b) => a - b);
  if (unique.length === 0) return "页码未知";
  if (unique.length === 1) return `第 ${unique[0]} 页`;
  return `第 ${unique[0]}-${unique.at(-1)} 页`;
}

function renderNoteKind(kind) {
  if (kind === "analysis") return "分析";
  if (kind === "chat") return "回答";
  if (kind === "reflection") return "感受";
  return "原文";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function findParagraphForText(text) {
  const needle = String(text || "").trim();
  if (!needle) return null;
  const candidates = [needle, needle.slice(0, 40), needle.slice(-40)].filter((item) => item.length >= 4);
  return [...document.querySelectorAll(".paragraph")].find((paragraph) => {
    const rawText = paragraph.dataset.rawText || paragraph.textContent || "";
    return candidates.some((candidate) => rawText.includes(candidate));
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssEscape(value) {
  return window.CSS?.escape ? CSS.escape(value) : String(value).replaceAll('"', '\\"');
}
