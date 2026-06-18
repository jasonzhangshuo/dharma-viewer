const CHAT_PROVIDERS = {
  codex: { label: "Codex", title: "Codex Chat", ask: "问 Codex", thinking: "已发送给 Codex，正在思考..." },
  hermes: { label: "Hermes", title: "Hermes Chat", ask: "问 Hermes", thinking: "已发送给 Hermes，正在思考..." },
  claude: { label: "Claude Code", title: "Claude Code Chat", ask: "问 Claude", thinking: "已发送给 Claude Code，正在思考..." },
  openclaw: { label: "OpenClaw", title: "OpenClaw Chat", ask: "问 OpenClaw", thinking: "已发送给 OpenClaw，正在思考..." },
};

const FEEDBACK_LABELS = [
  { id: "hit-me", label: "命中我" },
  { id: "summary-taste", label: "总结味" },
  { id: "dharma-inaccurate", label: "法义不准" },
  { id: "too-abstract", label: "太抽象" },
  { id: "insightful", label: "有启发" },
  { id: "keep", label: "可保留" },
  { id: "rewrite", label: "要重写" },
];

const state = {
  data: null,
  activeDocId: null,
  lastHighlightId: null,
  selectedContexts: [],
  pendingSelection: null,
  agentSessionId: "",
  chatMessages: [],
  notes: [],
  relatedNotes: { currentNotes: [], relatedNotes: [] },
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
const mindmapContent = document.querySelector("#mindmapContent");
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
const saveFeedbackFromSelection = document.querySelector("#saveFeedbackFromSelection");
const sourceTab = document.querySelector("#sourceTab");
const auxiliaryTab = document.querySelector("#auxiliaryTab");
const mindmapTab = document.querySelector("#mindmapTab");
const sourceTabs = document.querySelector("#sourceTabs");
const chatTab = document.querySelector("#chatTab");
const notesTab = document.querySelector("#notesTab");
const noteCount = document.querySelector("#noteCount");
const notesPanel = document.querySelector("#notesPanel");
const libraryLink = document.querySelector("#libraryLink");

init();

if (STATIC_VIEWER) {
  window.addEventListener("hashchange", () => init());
} else {
  window.addEventListener("hashchange", () => {
    const panel = sourcePanelFromHash();
    if (panel) switchSourcePanel(panel);
  });
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
    renderChatProvider();
    renderChatSession();
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
  const noteIndex = STATIC_VIEWER ? { notes: [] } : await fetchNoteIndex();
  appTitle.textContent = "学习库";
  status.textContent = `已扫描：${library.viewerRoot}`;
  renderLibrary(library, noteIndex);
}

async function fetchNoteIndex() {
  const response = await fetch("/api/notes");
  return response.ok ? response.json() : { notes: [] };
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

function renderLibrary(library, noteIndex = { notes: [] }) {
  const items = Array.isArray(library.workspaces) ? library.workspaces : [];
  const noteSummary = renderLibraryNotesSummary(library, noteIndex);
  workspace.className = "library-workspace";
  workspace.innerHTML = `
    <section class="library-hero">
      <p class="pane-kicker">已发布课程</p>
      <h2>从这里回到任意一课的学习现场</h2>
      <p>每个课程入口会打开最新发布的分析页；历史分析和我的笔记仍按 workspace 保存在本地。</p>
    </section>
    ${noteSummary}
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

function renderLibraryNotesSummary(library, noteIndex) {
  const noteCount = Number(library.noteCount || noteIndex.noteCount || 0);
  if (!noteCount) return "";
  const recentNotes = (Array.isArray(noteIndex.notes) ? noteIndex.notes : []).slice(0, 5);

  return `
    <section class="library-hero library-notes-summary">
      <p class="pane-kicker">我的学习笔记</p>
      <h2>全部笔记</h2>
      <p>已保存 ${noteCount} 条个人修学笔记。打开课程可查看本课笔记、候选照见和相关历史笔记。</p>
      ${
        recentNotes.length
          ? `<div class="library-note-list">${recentNotes.map(renderLibraryNoteItem).join("")}</div>`
          : ""
      }
    </section>
  `;
}

function renderLibraryNoteItem(note) {
  return `
    <a class="library-note-item" href="${escapeHtml(note.latestUrl || `/view/${encodeURIComponent(note.workspace || "")}/latest`)}">
      <span>${escapeHtml(note.workspaceTitle || note.workspace || "课程笔记")}</span>
      <strong>${escapeHtml(compactText(note.text || note.comment || "", 82))}</strong>
      <time>${formatDateTime(note.updatedAt || note.createdAt)}</time>
    </a>
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

saveFeedbackFromSelection.addEventListener("click", async () => {
  if (!state.pendingSelection || state.pendingSelection.kind !== "analysis") return;
  openFeedbackDraft({
    text: state.pendingSelection.text,
    quote: state.pendingSelection.text,
  });
  selectionToolbar.hidden = true;
  window.getSelection()?.removeAllRanges();
});

sourceTabs.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const button = target?.closest("[data-source-panel]");
  if (!button || !sourceTabs.contains(button)) return;
  event.preventDefault();
  const panel = switchSourcePanel(button.dataset.sourcePanel);
  updateSourcePanelHash(panel);
});
chatTab.addEventListener("click", () => switchSidePanel("chat"));
notesTab.addEventListener("click", () => switchSidePanel("notes"));

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
                <p class="paragraph ${sourceParagraphClass(paragraph)}" id="${paragraph.id}" data-kind="${
                  sourceParagraphKind(paragraph)
                }" data-page-label="${formatPageLabel(
                  paragraph.pageNumbers ?? [paragraph.pageNumber]
                )}" data-raw-text="${escapeHtml(paragraph.text)}" title="原 PDF：${formatPageLabel(paragraph.pageNumbers ?? [paragraph.pageNumber])}">
                  <span class="source-text">${formatSourceParagraph(paragraph.text, sourceParagraphKind(paragraph))}</span>
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
  const auxiliaryMaterials = materials.filter((item) => item.role !== "mindmap");
  const mindmapMaterials = materials.filter((item) => item.role === "mindmap");

  mindmapTab.hidden = mindmapMaterials.length === 0;
  if (state.activeSourcePanel === "mindmap" && mindmapMaterials.length === 0) {
    state.activeSourcePanel = "source";
  }

  if (!auxiliaryMaterials.length) {
    auxiliaryContent.innerHTML = `<div class="auxiliary-empty">暂无可展示的辅助材料。</div>`;
  } else {
    auxiliaryContent.innerHTML = auxiliaryMaterials
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

  mindmapContent.innerHTML = mindmapMaterials.length
    ? mindmapMaterials.map(renderMindmapMaterial).join("")
    : `<div class="auxiliary-empty">暂无可展示的思维导图。</div>`;

  switchSourcePanel(sourcePanelFromHash() || state.activeSourcePanel);
}

function renderMindmapMaterial(item) {
  return `
    <article class="mindmap-card">
      <div class="auxiliary-heading">
        <h3>${escapeHtml(item.title || "思维导图")}</h3>
      </div>
      <div class="mindmap-tree">${renderMindmapTree(item.content || item.markdown || "")}</div>
    </article>
  `;
}

function renderMindmapTree(value) {
  const tree = parseMindmapMarkdown(value);
  if (!tree.length) return renderPlainText(value);
  return tree.map(renderMindmapNode).join("");
}

function parseMindmapMarkdown(value) {
  const lines = String(value ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^识别(?:来源|状态)[:：]/.test(line));

  const root = [];
  const stack = [{ level: 0, children: root }];

  for (const line of lines) {
    if (/^#\s+/.test(line)) continue;
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    const headingText = heading?.[2]?.trim() || "";
    if (/^(可用于|与辅助材料)/.test(headingText)) break;

    const numbered = line.match(/^([0-9]+)[.．]\s*(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const plainTitle = line.match(/^(总主题|主线分为两大块)[:：]\s*(.*)$/);

    let level = 3;
    let text = line;
    let kind = "note";

    if (heading) {
      level = heading[1].length - 1;
      text = heading[2].trim();
      kind = level <= 1 ? "root" : "branch";
    } else if (numbered) {
      level = 4;
      text = numbered[2].trim();
      kind = "leaf";
    } else if (bullet) {
      level = 4;
      text = bullet[1].trim();
      kind = "leaf";
    } else if (plainTitle) {
      level = 2;
      text = plainTitle[2] ? `${plainTitle[1]}：${plainTitle[2]}` : plainTitle[1];
      kind = "branch";
    } else if (/^同喜复习课/.test(line)) {
      level = 2;
      kind = "branch";
    }

    const node = { text, kind, children: [] };
    while (stack.length > 1 && stack.at(-1).level >= level) stack.pop();
    stack.at(-1).children.push(node);
    stack.push({ level, children: node.children });
  }

  return root;
}

function renderMindmapNode(node) {
  const parts = splitMindmapNodeText(node.text);
  const hasChildren = node.children?.length;
  return `
    <div class="mindmap-node mindmap-node-${escapeHtml(node.kind || "note")}">
      <div class="mindmap-node-content">
        ${parts.label ? `<strong>${escapeHtml(parts.label)}</strong>` : ""}
        <span>${linkifyPlainText(parts.body)}</span>
      </div>
      ${hasChildren ? `<div class="mindmap-children">${node.children.map(renderMindmapNode).join("")}</div>` : ""}
    </div>
  `;
}

function splitMindmapNodeText(text) {
  const value = String(text || "").trim();
  const match = value.match(/^([^：:]{2,24})[：:]\s*(.+)$/);
  if (!match) return { label: "", body: value };
  return { label: match[1], body: match[2] };
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
  const sourceElement =
    closestWithin(range.commonAncestorContainer, sourceContent) ||
    closestWithin(range.commonAncestorContainer, auxiliaryContent) ||
    closestWithin(range.commonAncestorContainer, mindmapContent);
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
  saveFeedbackFromSelection.hidden = state.pendingSelection.kind !== "analysis";

  const rect = range.getBoundingClientRect();
  selectionToolbar.style.left = `${Math.min(window.innerWidth - 220, Math.max(12, rect.left + rect.width / 2 - 88))}px`;
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
    await loadRelatedNotes();
  } catch (error) {
    state.notes = [];
    state.relatedNotes = { currentNotes: [], relatedNotes: [] };
    appendChatMessage("system", `加载笔记失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
  renderNotes();
}

async function loadRelatedNotes() {
  const params = new URLSearchParams();
  currentNoteThemes().forEach((theme) => params.append("theme", theme));
  const url = `${relatedNotesApiUrl()}${params.toString() ? `?${params.toString()}` : ""}`;

  try {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    state.relatedNotes = {
      currentNotes: Array.isArray(payload.currentNotes) ? payload.currentNotes : [],
      relatedNotes: Array.isArray(payload.relatedNotes) ? payload.relatedNotes : [],
    };
  } catch (error) {
    state.relatedNotes = { currentNotes: [], relatedNotes: [] };
    appendChatMessage("system", `加载相关笔记失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
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
    await loadRelatedNotes();
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
    await loadRelatedNotes();
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
    await loadRelatedNotes();
    renderNotes();
  } catch (error) {
    appendChatMessage("system", `保存感受失败：${error instanceof Error ? error.message : "未知错误"}`);
  }
}

async function updateNoteInsightStatus(noteId, type, insightId, status) {
  try {
    const response = await fetch(`${notesApiUrl()}/${encodeURIComponent(noteId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        insightStatus: {
          id: insightId,
          type,
          status,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
    state.notes = state.notes.map((item) => (item.id === result.note.id ? result.note : item));
    await loadRelatedNotes();
    renderNotes();
  } catch (error) {
    appendChatMessage("system", `更新照见状态失败：${error instanceof Error ? error.message : "未知错误"}`);
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
  if (!["source", "auxiliary", "mindmap"].includes(panel)) panel = "source";
  if (panel === "mindmap" && mindmapTab.hidden) panel = "source";
  state.activeSourcePanel = panel;
  const isSource = panel === "source";
  const isAuxiliary = panel === "auxiliary";
  const isMindmap = panel === "mindmap";
  sourceTab.classList.toggle("is-active", isSource);
  auxiliaryTab.classList.toggle("is-active", isAuxiliary);
  mindmapTab.classList.toggle("is-active", isMindmap);
  sourceContent.hidden = !isSource;
  auxiliaryContent.hidden = !isAuxiliary;
  mindmapContent.hidden = !isMindmap;
  sourceSearch.disabled = !isSource;
  return state.activeSourcePanel;
}

window.__dharmaSwitchSourcePanel = switchSourcePanel;

function updateSourcePanelHash(panel) {
  const nextHash = sourceHashForPanel(panel);
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
}

function sourceHashForPanel(panel) {
  if (panel === "auxiliary") return "#source-auxiliary";
  if (panel === "mindmap") return "#source-mindmap";
  return "#source-original";
}

function sourcePanelFromHash() {
  if (window.location.hash === "#source-auxiliary") return "auxiliary";
  if (window.location.hash === "#source-mindmap") return "mindmap";
  if (window.location.hash === "#source-original") return "source";
  return "";
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
          ${renderFeedbackLabels(note.feedbackLabels)}
          ${note.comment ? `<div class="note-comment"><strong>我的感受</strong><p>${escapeHtml(note.comment)}</p></div>` : ""}
          ${renderNoteInsights(note)}
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
      .join("") +
    renderRelatedNotes();

  bindNotePanelActions();
}

function renderNoteInsights(note) {
  const blackCandidates = Array.isArray(note.insights?.blackCardCandidates) ? note.insights.blackCardCandidates : [];
  const whiteCandidates = Array.isArray(note.insights?.whiteCardCandidates) ? note.insights.whiteCardCandidates : [];
  const items = [
    ...blackCandidates.map((candidate) => ({ ...candidate, type: "black", typeLabel: "黑牌线索" })),
    ...whiteCandidates.map((candidate) => ({ ...candidate, type: "white", typeLabel: "白牌方向" })),
  ].filter((candidate) => candidate.status !== "dismissed");

  if (!items.length) return "";

  return `
    <div class="note-insights">
      <strong>候选照见</strong>
      ${items.map((candidate) => renderInsightCandidate(note, candidate)).join("")}
    </div>
  `;
}

function renderFeedbackLabels(labels) {
  const normalized = (Array.isArray(labels) ? labels : [])
    .map((id) => FEEDBACK_LABELS.find((item) => item.id === id))
    .filter(Boolean);
  if (!normalized.length) return "";
  return `<div class="feedback-chip-list">${normalized.map((item) => `<span class="feedback-chip">${escapeHtml(item.label)}</span>`).join("")}</div>`;
}

function renderInsightCandidate(note, candidate) {
  const isConfirmed = candidate.status === "confirmed";
  return `
    <div class="note-insight note-insight-${escapeHtml(candidate.type)}">
      <div>
        <span>${escapeHtml(candidate.typeLabel)}</span>
        <p>${escapeHtml(candidate.label)}</p>
        ${candidate.evidence ? `<small>${escapeHtml(candidate.evidence)}</small>` : ""}
      </div>
      <div class="note-insight-actions">
        ${
          isConfirmed
            ? `<span class="insight-status">已确认</span>`
            : `<button type="button" data-insight-confirm="${escapeHtml(note.id)}" data-insight-type="${escapeHtml(candidate.type)}" data-insight-id="${escapeHtml(candidate.id)}">确认</button>
               <button type="button" data-insight-dismiss="${escapeHtml(note.id)}" data-insight-type="${escapeHtml(candidate.type)}" data-insight-id="${escapeHtml(candidate.id)}">忽略</button>`
        }
      </div>
    </div>
  `;
}

function renderRelatedNotes() {
  const related = Array.isArray(state.relatedNotes.relatedNotes) ? state.relatedNotes.relatedNotes : [];
  if (!related.length) return "";

  return `
    <section class="related-notes">
      <h3>相关历史笔记</h3>
      ${related.map(renderRelatedNote).join("")}
    </section>
  `;
}

function renderRelatedNote(note) {
  return `
    <article class="related-note-card">
      <div class="note-meta">
        <span>${escapeHtml(note.workspaceTitle || note.workspace || "历史笔记")}</span>
        <time>${formatDateTime(note.createdAt)}</time>
      </div>
      <p>${escapeHtml(compactText(note.text || note.comment || "", 150))}</p>
      ${note.reason ? `<div class="related-reason">${escapeHtml(note.reason)}</div>` : ""}
      <div class="note-actions">
        <button type="button" data-related-context data-related-workspace="${escapeHtml(note.workspace)}" data-related-note-id="${escapeHtml(note.id)}">加入提问</button>
        <a class="note-link" href="${escapeHtml(note.viewUrl || `/view/${encodeURIComponent(note.workspace || "")}/latest`)}">打开课程</a>
      </div>
    </article>
  `;
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
  const isFeedbackDraft = draft?.kind === "feedback";
  return `
    <form id="noteComposer" class="note-composer">
      ${draft ? `<div class="note-draft">
        <span>${renderNoteKind(draft.kind)}</span>
        <p>${escapeHtml(compactText(draft.text, 120))}</p>
      </div>` : ""}
      ${isFeedbackDraft ? renderFeedbackLabelPicker(draft.feedbackLabels || []) : ""}
      <textarea id="noteCommentInput" rows="4" placeholder="${
        isFeedbackDraft ? "写一句原因：为什么命中、哪里总结味、哪里不准..." : draft ? "写下这段摘录给你的提醒、触动或行动..." : "直接写一条自己的感受..."
      }" aria-label="写笔记">${draft?.comment ? escapeHtml(draft.comment) : ""}</textarea>
      <div class="note-composer-actions">
        ${draft ? `<button id="cancelNoteDraft" class="secondary-button" type="button">取消摘录</button>` : "<span></span>"}
        <button id="saveNoteDraft" class="primary-button" type="submit">${isFeedbackDraft ? "保存标注" : draft ? "保存完整笔记" : "保存感受"}</button>
      </div>
    </form>
  `;
}

function renderFeedbackLabelPicker(selectedLabels) {
  const selected = new Set(selectedLabels);
  return `
    <div class="feedback-label-grid" aria-label="选择校准标签">
      ${FEEDBACK_LABELS.map((item) => `
        <button class="feedback-chip${selected.has(item.id) ? " is-selected" : ""}" type="button" data-feedback-label="${escapeHtml(item.id)}">
          ${escapeHtml(item.label)}
        </button>
      `).join("")}
    </div>
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

  notesPanel.querySelectorAll("button[data-feedback-label]").forEach((button) => {
    button.addEventListener("click", () => {
      const label = button.dataset.feedbackLabel || "";
      const current = new Set(state.noteDraft?.feedbackLabels || []);
      if (current.has(label)) {
        current.delete(label);
      } else {
        current.add(label);
      }
      state.noteDraft = {
        ...(state.noteDraft || {}),
        kind: "feedback",
        feedbackLabels: [...current],
      };
      renderNotes();
      document.querySelector("#noteCommentInput")?.focus();
    });
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

  notesPanel.querySelectorAll("button[data-insight-confirm], button[data-insight-dismiss]").forEach((button) => {
    button.addEventListener("click", async () => {
      const noteId = button.dataset.insightConfirm || button.dataset.insightDismiss || "";
      const status = button.dataset.insightConfirm ? "confirmed" : "dismissed";
      await updateNoteInsightStatus(noteId, button.dataset.insightType || "", button.dataset.insightId || "", status);
    });
  });

  notesPanel.querySelectorAll("button[data-related-context]").forEach((button) => {
    button.addEventListener("click", () => {
      const workspace = button.dataset.relatedWorkspace || "";
      const noteId = button.dataset.relatedNoteId || "";
      const note = (state.relatedNotes.relatedNotes || []).find((item) => item.workspace === workspace && item.id === noteId);
      if (!note) return;
      addSelectedContext({ kind: note.kind || "reflection", text: noteContextText(note) });
      switchSidePanel("chat");
    });
  });
}

function openNoteDraft(draft) {
  state.noteDraft = draft;
  switchSidePanel("notes");
  renderNotes();
  document.querySelector("#noteCommentInput")?.focus();
}

function openFeedbackDraft(draft) {
  openNoteDraft({
    kind: "feedback",
    text: draft.text,
    quote: draft.quote,
    feedbackLabels: [],
  });
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

function relatedNotesApiUrl() {
  return `/api/view/${encodeURIComponent(currentWorkspace())}/related-notes`;
}

function currentNoteThemes() {
  const themes = state.notes.flatMap((note) => (Array.isArray(note.insights?.themes) ? note.insights.themes : []));
  return [...new Set(themes.map((theme) => String(theme || "").trim()).filter(Boolean))].slice(0, 8);
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

    if (/^-{3,}$/.test(line)) {
      closeList();
      closeSection();
      html.push("<hr>");
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
  if (sourceText) {
    sourceText.innerHTML = formatSourceParagraph(target.dataset.rawText ?? sourceText.textContent, target.dataset.kind || "");
  }
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

function sourceParagraphClass(paragraph) {
  const kind = sourceParagraphKind(paragraph);
  if (kind === "verse") return "source-verse";
  if (kind === "subheading") return "source-numbered-heading";
  return "";
}

function sourceParagraphKind(paragraph) {
  if (paragraph?.kind) return paragraph.kind;
  const parsed = parseNumberedLine(paragraph?.text);
  if (!parsed.number) return "body";
  const number = Number(parsed.number);
  const body = String(parsed.text || "").trim();
  if (number >= 10 && /[！。？]$/.test(body)) return "verse";
  if (number < 10 && body.length <= 24 && !/[。！？]$/.test(body)) return "subheading";
  return "body";
}

function formatSourceParagraph(text, kind = "") {
  if (kind === "verse") {
    const parsed = parseNumberedLine(text);
    if (parsed.number) {
      return `<span class="source-verse-number">${escapeHtml(parsed.number)}</span><span class="source-verse-body">${escapeHtml(
        parsed.text
      )}</span>`;
    }
  }

  if (kind === "subheading") {
    const parsed = parseNumberedLine(text);
    if (parsed.number) {
      return `<strong class="source-numbered-heading-label">${escapeHtml(parsed.number)}. ${escapeHtml(parsed.text)}</strong>`;
    }
  }

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
  if (kind === "feedback") return "校准";
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
