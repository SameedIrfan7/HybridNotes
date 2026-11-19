import {
  runAI,
  initOnDeviceModel,
  getOnDeviceStatus,
  getMaxOnDeviceChars,
  sanitizeForCloud,
  runChunkedOnDevice,
} from "./ai.js";
import { decideRoute } from "./router.js";

const NOTES_KEY = "hybridnotes_notes";
const STATS_KEY = "hybridnotes_stats";
const TOUR_KEY = "hybridnotes_tour_done";
const PROFILE_KEY = "hybridnotes_profile";

const DEFAULT_PROFILE = {
  name: "Student",
  focus: "",
  defaultPrivate: false,
};
const DEFAULT_TITLE = "New Study Chat";

const DEFAULT_STATS = {
  onDeviceCount: 0,
  cloudCount: 0,
  onDeviceTotalMs: 0,
  cloudTotalMs: 0,
  cloudCallsAvoided: 0,
  bytesSaved: 0,
};

const TASK_LABELS = {
  summarize: "Summarize",
  quiz: "Quiz Me",
  grammar: "Fix grammar",
  title: "Suggest title",
  todos: "Extract to-dos",
  "deep-analyze": "Deep Analyze",
  translate: "Translate",
};

const navHomeBtn = document.getElementById("nav-home-btn");
const navWorkspaceBtn = document.getElementById("nav-workspace-btn");
const launchWorkspaceBtn = document.getElementById("launch-workspace-btn");
const footerLaunchBtn = document.getElementById("footer-launch-btn");
const homeView = document.getElementById("home-view");
const workspaceView = document.getElementById("workspace-view");
const simOfflineToggle = document.getElementById("sim-offline-toggle");
const mobileSimOfflineToggle = document.getElementById("mobile-sim-offline-toggle");
const nanoStatusPill = document.getElementById("nano-status-pill");
const mobileNanoStatusPill = document.getElementById("mobile-nano-status-pill");

const carouselTrack = document.getElementById("carousel-track");
const carouselPrev = document.getElementById("carousel-prev");
const carouselNext = document.getElementById("carousel-next");
const carouselDots = document.getElementById("carousel-dots");
const carouselToggle = document.getElementById("carousel-toggle");

const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const closeDrawerBtn = document.getElementById("close-drawer-btn");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const sidebar = document.getElementById("sidebar");

const offlineBanner = document.getElementById("offline-banner");
const noteListEl = document.getElementById("note-list");
const newNoteBtn = document.getElementById("new-note-btn");
const deleteNoteBtn = document.getElementById("delete-note-btn");
const titleInput = document.getElementById("note-title");
const renameNoteBtn = document.getElementById("rename-note-btn");
const privateToggle = document.getElementById("private-toggle");
const contentInput = document.getElementById("note-content");
const charCountEl = document.getElementById("char-count");
const actionBtns = document.querySelectorAll(".action-btn");
const translateLangEl = document.getElementById("translate-lang");
const taskMenuBtn = document.getElementById("task-menu-btn");
const taskPopover = document.getElementById("task-popover");
const selectedTaskChip = document.getElementById("selected-task-chip");
const modelMenuBtn = document.getElementById("model-menu-btn");
const modelPopover = document.getElementById("model-popover");
const selectedModelChip = document.getElementById("selected-model-chip");
const modelOptBtns = document.querySelectorAll(".model-opt");
const runAiBtn = document.getElementById("run-ai-btn");
const cancelAiBtn = document.getElementById("cancel-ai-btn");
const runTimerEl = document.getElementById("run-timer");

const resultsFeed = document.getElementById("results-feed");
const chatThreadEl = document.getElementById("chat-thread");

const statsCard = document.getElementById("stats-card");
const resetStatsBtn = document.getElementById("reset-stats-btn");
const statsSummaryEl = document.getElementById("stats-summary");
const statOnDeviceMeta = document.getElementById("stat-ondevice-meta");
const statCloudMeta = document.getElementById("stat-cloud-meta");
const statOnDeviceBar = document.getElementById("stat-ondevice-bar");
const statCloudBar = document.getElementById("stat-cloud-bar");

const statsModal = document.getElementById("stats-modal");
const closeStatsModal = document.getElementById("close-stats-modal");
const modalOnDevicePct = document.getElementById("modal-ondevice-pct");
const modalAvoided = document.getElementById("modal-avoided");
const modalKbSaved = document.getElementById("modal-kb-saved");
const modalThreshold = document.getElementById("modal-threshold");
const modalOnDeviceDetail = document.getElementById("modal-ondevice-detail");
const modalCloudDetail = document.getElementById("modal-cloud-detail");

const demoModal = document.getElementById("demo-modal");
const demoStepBadge = document.getElementById("demo-step-badge");
const demoStepTitle = document.getElementById("demo-step-title");
const demoStepDesc = document.getElementById("demo-step-desc");
const demoStagePill = document.getElementById("demo-stage-pill");
const demoInputLabel = document.getElementById("demo-input-label");
const demoTypedText = document.getElementById("demo-typed-text");
const demoOutputBox = document.getElementById("demo-output-box");
const demoOutBadge = document.getElementById("demo-out-badge");
const demoOutStat = document.getElementById("demo-out-stat");
const demoOutText = document.getElementById("demo-out-text");
const demoDots = document.getElementById("demo-dots");
const demoPrevBtn = document.getElementById("demo-prev-btn");
const demoNextBtn = document.getElementById("demo-next-btn");
const demoSkipBtn = document.getElementById("demo-skip-btn");

const profileBtn = document.getElementById("profile-btn");
const profileAvatarInitials = document.getElementById("profile-avatar-initials");
const profileModal = document.getElementById("profile-modal");
const closeProfileModal = document.getElementById("close-profile-modal");
const profileModalInitials = document.getElementById("profile-modal-initials");
const profileNameInput = document.getElementById("profile-name-input");
const profileFocusInput = document.getElementById("profile-focus-input");
const profileDefaultPrivate = document.getElementById("profile-default-private");
const profileQuotaSummary = document.getElementById("profile-quota-summary");
const profileChatsCount = document.getElementById("profile-chats-count");
const profileQuotaBar = document.getElementById("profile-quota-bar");
const profileSavingsLine = document.getElementById("profile-savings-line");
const profileExportBtn = document.getElementById("profile-export-btn");
const profileTourBtn = document.getElementById("profile-tour-btn");
const profileStatsBtn = document.getElementById("profile-stats-btn");
const profileClearBtn = document.getElementById("profile-clear-btn");

const nanoDownloadModal = document.getElementById("nano-download-modal");
const nanoDlClose = document.getElementById("nano-dl-close");
const nanoDlSkip = document.getElementById("nano-dl-skip");
const nanoDlConfirm = document.getElementById("nano-dl-confirm");
const nanoDlProgressWrap = document.getElementById("nano-dl-progress-wrap");
const nanoDlStatusText = document.getElementById("nano-dl-status-text");
const nanoDlPct = document.getElementById("nano-dl-pct");
const nanoDlBar = document.getElementById("nano-dl-bar");

let notes = loadNotes();
let activeId = notes[0]?.id || null;
let stats = loadStats();
let profile = loadProfile();
let maxOnDeviceChars = 1500;
let selectedTask = "summarize";
let selectedModel = "auto";
let activeAbortController = null;
let slideIndex = 0;
let carouselPaused = false;

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function initCarousel() {
  const slides = carouselTrack?.children?.length || 0;
  if (!slides) return;

  carouselDots.innerHTML = "";
  for (let i = 0; i < slides; i += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `carousel-dot${i === 0 ? " active" : ""}`;
    dot.setAttribute("aria-label", `Feature ${i + 1}`);
    dot.addEventListener("click", () => goToSlide(i));
    carouselDots.appendChild(dot);
  }

  carouselPrev.addEventListener("click", () => goToSlide(slideIndex - 1));
  carouselNext.addEventListener("click", () => goToSlide(slideIndex + 1));
  carouselToggle.addEventListener("click", () => {
    carouselPaused = !carouselPaused;
    carouselToggle.textContent = carouselPaused ? "Play" : "Pause";
  });

  setInterval(() => {
    if (!homeView.hidden && !carouselPaused) goToSlide(slideIndex + 1);
  }, 5000);
}

function goToSlide(idx) {
  const slides = carouselTrack?.children?.length || 0;
  if (!slides) return;
  slideIndex = (idx + slides) % slides;
  carouselTrack.style.transform = `translateX(-${slideIndex * 100}%)`;
  Array.from(carouselDots.children).forEach((dot, i) => {
    dot.classList.toggle("active", i === slideIndex);
  });
}

function setDrawerOpen(open) {
  sidebar.classList.toggle("drawer-open", open);
  drawerBackdrop.hidden = !open;
  mobileMenuBtn.setAttribute("aria-expanded", String(open));
}

const MODEL_CHIP_LABELS = {
  auto: "Auto",
  nano: "Gemini Nano",
  "flash-lite": "Flash-Lite",
};

function formatSec(ms) {
  if (typeof ms !== "number" || Number.isNaN(ms)) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function setPopoverOpen(open) {
  taskPopover.hidden = !open;
  taskMenuBtn.setAttribute("aria-expanded", String(open));
  if (open && modelPopover) setModelPopoverOpen(false);
}

function setModelPopoverOpen(open) {
  if (!modelPopover || !modelMenuBtn) return;
  modelPopover.hidden = !open;
  modelMenuBtn.setAttribute("aria-expanded", String(open));
  if (open) {
    taskPopover.hidden = true;
    taskMenuBtn.setAttribute("aria-expanded", "false");
  }
}

function selectModel(model) {
  selectedModel = model;
  modelOptBtns.forEach((btn) => {
    const active = btn.dataset.model === model;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
  if (selectedModelChip) {
    selectedModelChip.textContent = MODEL_CHIP_LABELS[model] || "Auto";
  }
}

function syncViewLayout() {
  const isHome = !homeView.hidden;
  const isMobile = window.matchMedia("(max-width: 820px)").matches;
  if (isHome && isMobile) {
    workspaceView.hidden = false;
    workspaceView.classList.add("mobile-drawer-host");
  } else {
    workspaceView.classList.remove("mobile-drawer-host");
    workspaceView.hidden = isHome;
  }
}

function showView(view) {
  const isHome = view === "home";
  homeView.hidden = !isHome;
  navHomeBtn.classList.toggle("active", isHome);
  navWorkspaceBtn.classList.toggle("active", !isHome);
  navHomeBtn.setAttribute("aria-selected", String(isHome));
  navWorkspaceBtn.setAttribute("aria-selected", String(!isHome));
  setDrawerOpen(false);
  setPopoverOpen(false);
  setModelPopoverOpen(false);
  setModelPopoverOpen(false);
  syncViewLayout();
  if (!isHome) {
    autoResizeEditor();
    scrollFeedToBottom();
    if (!localStorage.getItem(TOUR_KEY)) {
      openDemoModal(0);
    }
  }
}

function isAppOffline() {
  return !navigator.onLine || simOfflineToggle.checked;
}

function autoResizeEditor() {
  contentInput.style.height = "auto";
  contentInput.style.height = `${Math.min(contentInput.scrollHeight, 200)}px`;
}

function scrollFeedToBottom() {
  if (!resultsFeed) return;
  resultsFeed.scrollTop = resultsFeed.scrollHeight;
}

function deriveTitle(content) {
  const cleaned = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!cleaned) return DEFAULT_TITLE;
  return cleaned.length > 38 ? `${cleaned.slice(0, 38)}…` : cleaned;
}

function selectTask(task) {
  selectedTask = task;
  actionBtns.forEach((btn) => {
    const isSelected = btn.dataset.task === task;
    btn.classList.toggle("active", isSelected);
    btn.setAttribute("aria-checked", String(isSelected));
  });
  updateSelectedChip();
}

function updateSelectedChip() {
  const base = TASK_LABELS[selectedTask] || "Summarize";
  selectedTaskChip.textContent =
    selectedTask === "translate"
      ? `Translate (${translateLangEl.value})`
      : base;
}

function createNote(initial = {}) {
  return {
    id: makeId(),
    title: initial.title || DEFAULT_TITLE,
    draft: initial.draft || "",
    isPrivate: Boolean(initial.isPrivate),
    autoTitled: initial.title ? false : true,
    messages: Array.isArray(initial.messages) ? initial.messages : [],
    updatedAt: Date.now(),
  };
}

function migrateNote(raw) {
  const messages = Array.isArray(raw.messages) ? [...raw.messages] : [];
  if (messages.length === 0 && typeof raw.content === "string" && raw.content.trim()) {
    messages.push({
      id: makeId(),
      role: "user",
      taskLabel: "Study Note",
      text: raw.content.trim(),
      createdAt: raw.updatedAt || Date.now(),
    });
  }
  return {
    id: raw.id || makeId(),
    title: raw.title || DEFAULT_TITLE,
    draft: typeof raw.draft === "string" ? raw.draft : "",
    isPrivate: Boolean(raw.isPrivate),
    autoTitled: typeof raw.autoTitled === "boolean" ? raw.autoTitled : raw.title === DEFAULT_TITLE,
    messages,
    updatedAt: raw.updatedAt || Date.now(),
  };
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(migrateNote);
      }
    }
  } catch {
    // Ignore malformed localStorage and fall back to starter chat.
  }

  const blankChat = createNote();
  localStorage.setItem(NOTES_KEY, JSON.stringify([blankChat]));
  return [blankChat];
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      return { ...DEFAULT_STATS, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore malformed stats.
  }
  return { ...DEFAULT_STATS };
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordStat(source, ms, payloadBytes = 0) {
  if (source === "on-device") {
    stats.onDeviceCount += 1;
    stats.onDeviceTotalMs += ms;
    stats.cloudCallsAvoided += 1;
    stats.bytesSaved += payloadBytes;
  } else {
    stats.cloudCount += 1;
    stats.cloudTotalMs += ms;
  }
  saveStats();
  renderStats();
}

function renderStats() {
  const total = stats.onDeviceCount + stats.cloudCount;
  const onPct = total ? Math.round((stats.onDeviceCount / total) * 100) : 0;
  const cloudPct = total ? 100 - onPct : 0;
  const onAvg = stats.onDeviceCount
    ? Math.round(stats.onDeviceTotalMs / stats.onDeviceCount)
    : null;
  const cloudAvg = stats.cloudCount
    ? Math.round(stats.cloudTotalMs / stats.cloudCount)
    : null;
  const kbSaved = (stats.bytesSaved / 1024).toFixed(1);

  statsSummaryEl.textContent = `${onPct}% on-device · ${stats.cloudCallsAvoided} avoided · ${kbSaved} KB saved`;
  statOnDeviceMeta.textContent = `${stats.onDeviceCount} · ${onAvg !== null ? formatSec(onAvg) : "—"}`;
  statCloudMeta.textContent = `${stats.cloudCount} · ${cloudAvg !== null ? formatSec(cloudAvg) : "—"}`;
  statOnDeviceBar.style.width = `${onPct}%`;
  statCloudBar.style.width = `${cloudPct}%`;

  modalOnDevicePct.textContent = `${onPct}%`;
  modalAvoided.textContent = String(stats.cloudCallsAvoided);
  modalKbSaved.textContent = `${kbSaved} KB`;
  modalThreshold.textContent = `${maxOnDeviceChars} chars`;
  modalOnDeviceDetail.textContent = `${stats.onDeviceCount} runs · ${onAvg !== null ? `${formatSec(onAvg)} avg` : "—"}`;
  modalCloudDetail.textContent = `${stats.cloudCount} runs · ${cloudAvg !== null ? `${formatSec(cloudAvg)} avg` : "—"}`;
}

const GEMINI_SPARKLE_SVG =
  '<svg class="inline-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.4 5.2 4.8 9.6 10 10-5.2.4-9.6 4.8-10 10-.4-5.2-4.8-9.6-10-10 5.2-.4 9.6-4.8 10-10z"/></svg>';

let lastNanoStatus = "unavailable";

async function refreshNanoStatus() {
  const status = await getOnDeviceStatus();
  lastNanoStatus = status;
  const pills = [nanoStatusPill, mobileNanoStatusPill].filter(Boolean);
  for (const pill of pills) {
    pill.classList.remove("nano-ready", "nano-warn", "nano-clickable");
    if (status === "available") {
      pill.innerHTML = `${GEMINI_SPARKLE_SVG}<span>Gemini Nano ready</span>`;
      pill.classList.add("nano-ready");
    } else if (status === "downloading") {
      pill.innerHTML = `${GEMINI_SPARKLE_SVG}<span>Downloading Nano…</span>`;
      pill.classList.add("nano-warn", "nano-clickable");
    } else if (status === "downloadable") {
      pill.innerHTML = `${GEMINI_SPARKLE_SVG}<span>Enable Offline AI (~1.5 GB)</span>`;
      pill.classList.add("nano-warn", "nano-clickable");
      pill.title = "Click to download Gemini Nano once for offline use";
    } else {
      pill.innerHTML = `${GEMINI_SPARKLE_SVG}<span>Nano unavailable · using cloud</span>`;
      pill.classList.add("nano-warn");
    }
  }
}

function openNanoDownloadModal() {
  if (!nanoDownloadModal) return;
  if (lastNanoStatus !== "downloadable" && lastNanoStatus !== "downloading") return;
  setDrawerOpen(false);
  nanoDlConfirm.disabled = false;
  nanoDlConfirm.textContent = "Download Once (~1.5 GB)";
  nanoDlProgressWrap.hidden = lastNanoStatus !== "downloading";
  nanoDownloadModal.showModal();
}

nanoStatusPill?.addEventListener("click", openNanoDownloadModal);
mobileNanoStatusPill?.addEventListener("click", openNanoDownloadModal);
nanoDlClose?.addEventListener("click", () => nanoDownloadModal?.close());
nanoDlSkip?.addEventListener("click", () => nanoDownloadModal?.close());
nanoDownloadModal?.addEventListener("click", (e) => {
  if (e.target === nanoDownloadModal) nanoDownloadModal.close();
});

nanoDlConfirm?.addEventListener("click", async () => {
  nanoDlConfirm.disabled = true;
  nanoDlConfirm.textContent = "Downloading…";
  nanoDlProgressWrap.hidden = false;
  nanoDlStatusText.textContent = "Downloading Gemini Nano locally…";
  try {
    await initOnDeviceModel(
      (pct) => {
        nanoDlPct.textContent = `${pct}%`;
        nanoDlBar.style.width = `${pct}%`;
      },
      { allowDownload: true }
    );
    nanoDlPct.textContent = "100%";
    nanoDlBar.style.width = "100%";
    nanoDlStatusText.textContent = "Gemini Nano ready for offline use!";
    await refreshNanoStatus();
    setTimeout(() => nanoDownloadModal?.close(), 800);
  } catch (err) {
    nanoDlStatusText.textContent = err?.message || "Download failed or cancelled.";
    nanoDlConfirm.disabled = false;
    nanoDlConfirm.textContent = "Retry Download";
    await refreshNanoStatus();
  }
});

function getActiveNote() {
  return notes.find((n) => n.id === activeId) || null;
}

function renderSidebar() {
  noteListEl.innerHTML = "";
  for (const note of notes) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `note-item${note.id === activeId ? " active" : ""}`;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(note.id === activeId));
    btn.addEventListener("click", () => {
      activeId = note.id;
      if (!homeView.hidden) showView("workspace");
      else setDrawerOpen(false);
      renderAll();
renderProfile();
    });

    const titleSpan = document.createElement("span");
    titleSpan.className = "note-item-title";
    titleSpan.textContent = note.title.trim() || DEFAULT_TITLE;
    btn.appendChild(titleSpan);

    if (note.isPrivate) {
      const lock = document.createElement("span");
      lock.className = "note-lock";
      lock.textContent = "Private";
      btn.appendChild(lock);
    }

    li.appendChild(btn);
    noteListEl.appendChild(li);
  }
}

function renderThread() {
  const chat = getActiveNote();
  chatThreadEl.innerHTML = "";
  if (!chat || chat.messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    const h3 = document.createElement("h3");
    h3.textContent = "Ready when you are";
    const p = document.createElement("p");
    p.textContent =
      "Paste lecture notes or a study prompt below. Every message and AI summary stays saved locally on your device.";
    empty.append(h3, p);
    if (!localStorage.getItem(TOUR_KEY)) {
      const demoBtn = document.createElement("button");
      demoBtn.type = "button";
      demoBtn.className = "pill-btn btn-ghost chat-empty-btn";
      demoBtn.textContent = "Watch 15s Quick Demo →";
      demoBtn.addEventListener("click", () => openDemoModal(0));
      empty.appendChild(demoBtn);
    }
    chatThreadEl.appendChild(empty);
    return;
  }

  for (const msg of chat.messages) {
    if (msg.role === "user") {
      const bubble = document.createElement("article");
      bubble.className = "chat-msg-user";

      const meta = document.createElement("div");
      meta.className = "chat-msg-meta";
      const tag = document.createElement("span");
      tag.className = "chat-task-tag";
      tag.textContent = msg.taskLabel || "Prompt";
      const chars = document.createElement("span");
      chars.className = "mono";
      chars.textContent = `${msg.text.length} chars`;
      meta.append(tag, chars);

      const textEl = document.createElement("div");
      textEl.className = "chat-msg-text";
      textEl.textContent = msg.text;

      bubble.append(meta, textEl);
      chatThreadEl.appendChild(bubble);
    } else {
      const card = document.createElement("article");
      card.className = "result-card chat-msg-ai glass-panel";

      const header = document.createElement("div");
      header.className = "result-header";

      const badges = document.createElement("div");
      badges.className = "result-badges";

      const routeB = document.createElement("span");
      routeB.className = `badge ${msg.badgeClass || "badge-on-device"}`;
      const showSparkle = msg.badgeText === "Gemini Nano" || msg.badgeText === "Gemini 3.5 Flash-Lite" || msg.badgeText === "On-device" || msg.badgeText === "Cloud" || msg.badgeText === "Running...";
      routeB.innerHTML = showSparkle
        ? `${GEMINI_SPARKLE_SVG}<span>${msg.badgeText || "On-device"}</span>`
        : (msg.badgeText || "On-device");
      badges.appendChild(routeB);

      if (msg.privacySummary) {
        const privB = document.createElement("span");
        privB.className = "badge badge-sanitized";
        privB.textContent = msg.privacySummary;
        badges.appendChild(privB);
      }

      const latency = document.createElement("span");
      latency.className = "latency mono";
      latency.textContent = msg.latencyText || "";

      header.append(badges, latency);

      const reason = document.createElement("p");
      reason.className = "route-reason";
      reason.textContent = msg.reason || "";

      if (Array.isArray(msg.quizItems) && msg.quizItems.length > 0) {
        const quizList = document.createElement("div");
        quizList.className = "quiz-list";

        let answeredCount = 0;
        let correctCount = 0;

        msg.quizItems.forEach((item, qIdx) => {
          const qCard = document.createElement("div");
          qCard.className = "quiz-card";

          const qTitle = document.createElement("p");
          qTitle.className = "quiz-q";
          qTitle.textContent = `${qIdx + 1}. ${item.q}`;
          qCard.appendChild(qTitle);

          const optsWrap = document.createElement("div");
          optsWrap.className = "quiz-options";
          const isAnswered = typeof item.selectedIndex === "number";
          if (isAnswered) {
            answeredCount += 1;
            if (item.selectedIndex === item.answerIndex) correctCount += 1;
          }

          (item.options || []).forEach((optText, oIdx) => {
            const optBtn = document.createElement("button");
            optBtn.type = "button";
            optBtn.className = "quiz-opt-btn";
            optBtn.textContent = `${String.fromCharCode(65 + oIdx)}. ${optText}`;
            optBtn.disabled = isAnswered;

            if (isAnswered) {
              if (oIdx === item.answerIndex) {
                optBtn.classList.add("is-correct");
              } else if (oIdx === item.selectedIndex) {
                optBtn.classList.add("is-wrong");
              }
            }

            optBtn.addEventListener("click", () => {
              item.selectedIndex = oIdx;
              saveNotes();
              renderThread();
            });
            optsWrap.appendChild(optBtn);
          });

          qCard.appendChild(optsWrap);

          if (isAnswered) {
            const fb = document.createElement("p");
            const gotIt = item.selectedIndex === item.answerIndex;
            fb.className = `quiz-feedback ${gotIt ? "correct" : "wrong"}`;
            fb.textContent = `${gotIt ? "✓ Correct!" : `✗ Incorrect — Answer: ${String.fromCharCode(65 + item.answerIndex)}.`} ${item.explanation || ""}`;
            qCard.appendChild(fb);
          }

          quizList.appendChild(qCard);
        });

        const scoreBar = document.createElement("div");
        scoreBar.className = "quiz-score-bar mono";
        scoreBar.textContent = `Score: ${correctCount} / ${msg.quizItems.length} (${answeredCount} answered)`;
        quizList.appendChild(scoreBar);

        card.append(header, reason, quizList);
      } else {
        const body = document.createElement("div");
        const isThinking = msg.badgeText === "Running...";
        body.className = `result-body${isThinking ? " is-thinking" : ""}`;
        if (isThinking) {
          body.textContent = msg.text || "";
        } else {
          body.innerHTML = renderMarkdownSafe(msg.text || "");
        }
        card.append(header, reason, body);
      }
      chatThreadEl.appendChild(card);
    }
  }

  requestAnimationFrame(scrollFeedToBottom);
}

function renderEditor() {
  const note = getActiveNote();
  if (!note) return;
  titleInput.value = note.title;
  contentInput.value = note.draft || "";
  privateToggle.checked = note.isPrivate;
  charCountEl.textContent = `${(note.draft || "").trim().length} chars`;
  autoResizeEditor();
  renderThread();
}

function renderAll() {
  renderSidebar();
  renderEditor();
  renderStats();
}

function updateOfflineBanner() {
  offlineBanner.hidden = !isAppOffline();
}

function buildPrompt(task, text) {
  switch (task) {
    case "summarize":
      return `Summarize these study notes clearly in 3-4 bullet points:\n\n${text}`;
    case "quiz":
      return `Create 3-4 multiple-choice quiz questions based ONLY on these study notes. Return ONLY a valid JSON array with no markdown or extra text, using this exact schema: [{"q":"Question text?","options":["Option A","Option B","Option C","Option D"],"answerIndex":0,"explanation":"Short 1-sentence explanation."}]\n\nNotes:\n${text}`;
    case "grammar":
      return `Fix grammar and spelling in these study notes while keeping the meaning:\n\n${text}`;
    case "title":
      return `Suggest one concise, clear title (max 8 words) for these study notes:\n\n${text}`;
    case "todos":
      return `Extract actionable study to-dos or review items from these notes as a short bullet list:\n\n${text}`;
    case "deep-analyze":
      return `Provide a deep study analysis of these notes: key concepts, potential exam questions, and gaps to review:\n\n${text}`;
    case "translate":
      return `Translate these study notes accurately into ${translateLangEl.value}:\n\n${text}`;
    default:
      return text;
  }
}

let runTimerInterval = null;

function startRunTimer(aiMsg) {
  stopRunTimer();
  const startedAt = performance.now();
  if (runTimerEl) {
    runTimerEl.hidden = false;
    runTimerEl.textContent = "0.0s";
  }
  runTimerInterval = setInterval(() => {
    const secs = ((performance.now() - startedAt) / 1000).toFixed(1);
    if (runTimerEl) runTimerEl.textContent = `${secs}s`;
    if (aiMsg) {
      aiMsg.latencyText = `${secs}s…`;
      const latencyNodes = chatThreadEl.querySelectorAll(".latency");
      const lastLatency = latencyNodes[latencyNodes.length - 1];
      if (lastLatency) lastLatency.textContent = `${secs}s…`;
    }
  }, 100);
}

function stopRunTimer() {
  if (runTimerInterval) {
    clearInterval(runTimerInterval);
    runTimerInterval = null;
  }
  if (runTimerEl) {
    runTimerEl.hidden = true;
    runTimerEl.textContent = "0.0s";
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineMd(escapedLine) {
  return escapedLine
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/\$([^$\n]{1,32})\$/g, '<code class="md-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdownSafe(raw) {
  if (!raw) return "";
  const parts = String(raw).split(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g);
  let html = "";

  for (let i = 0; i < parts.length; i += 3) {
    const textPart = parts[i] || "";
    const lines = textPart.split(/\r?\n/);
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^(?:\*|-)\s+(.*)$/);
      const headingMatch = trimmed.match(/^#{1,3}\s+(.*)$/);

      if (bulletMatch) {
        if (!inList) {
          html += '<ul class="md-list">';
          inList = true;
        }
        html += `<li>${formatInlineMd(escapeHtml(bulletMatch[1]))}</li>`;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        if (headingMatch) {
          html += `<h4 class="md-heading">${formatInlineMd(escapeHtml(headingMatch[1]))}</h4>`;
        } else if (trimmed === "") {
          html += '<div class="md-spacer"></div>';
        } else {
          html += `<p class="md-p">${formatInlineMd(escapeHtml(line))}</p>`;
        }
      }
    }
    if (inList) html += "</ul>";

    if (i + 2 < parts.length) {
      const codeBody = escapeHtml((parts[i + 2] || "").replace(/\n$/, ""));
      html += `<pre class="md-code-block"><code>${codeBody}</code></pre>`;
    }
  }
  return html;
}

function parseQuizItems(rawText) {
  try {
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const valid = parsed.filter(
      (item) =>
        item &&
        typeof item.q === "string" &&
        Array.isArray(item.options) &&
        item.options.length >= 2 &&
        typeof item.answerIndex === "number"
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

function setRunning(running, aiMsg = null) {
  runAiBtn.hidden = running;
  runAiBtn.disabled = running;
  taskMenuBtn.disabled = running;
  if (modelMenuBtn) modelMenuBtn.disabled = running;
  cancelAiBtn.hidden = !running;
  if (running) {
    startRunTimer(aiMsg);
  } else {
    stopRunTimer();
  }
}

async function handleRun() {
  const chat = getActiveNote();
  if (!chat || activeAbortController) return;
  setPopoverOpen(false);

  const text = contentInput.value.trim();
  const task = selectedTask;
  const taskLabel =
    task === "translate"
      ? `Translate (${translateLangEl.value})`
      : TASK_LABELS[task] || "Prompt";

  if (!text) {
    contentInput.focus();
    return;
  }

  let route = decideRoute({
    task,
    text,
    isPrivate: chat.isPrivate,
    isOffline: isAppOffline(),
    maxOnDeviceChars,
  });

  if (!route.blocked && selectedModel === "nano") {
    route = {
      mode: "ONLY_ON_DEVICE",
      reason: "Model set to Gemini Nano (on-device only, 0 KB data).",
    };
  } else if (!route.blocked && selectedModel === "flash-lite") {
    if (chat.isPrivate || isAppOffline()) {
      route = {
        mode: null,
        blocked: true,
        reason: "Refused: Gemini 3.5 Flash-Lite requires cloud access, while Private or Offline mode locks this chat on-device.",
      };
    } else {
      route = {
        mode: "ONLY_IN_CLOUD",
        reason: "Model set to Gemini 3.5 Flash-Lite (cloud with identifier masking).",
      };
    }
  }

  if (chat.autoTitled) {
    chat.title = deriveTitle(text);
    titleInput.value = chat.title;
  }

  const userMsg = {
    id: makeId(),
    role: "user",
    taskLabel,
    text,
    createdAt: Date.now(),
  };

  chat.messages.push(userMsg);
  chat.draft = "";
  chat.updatedAt = Date.now();
  contentInput.value = "";
  charCountEl.textContent = "0 chars";
  autoResizeEditor();

  if (route.blocked || !route.mode) {
    chat.messages.push({
      id: makeId(),
      role: "assistant",
      badgeText: "Blocked",
      badgeClass: "badge-blocked",
      privacySummary: "",
      latencyText: "",
      reason: route.reason,
      text: "",
      createdAt: Date.now(),
    });
    saveNotes();
    renderAll();
    return;
  }

  const preferLocal = route.mode.includes("ON_DEVICE");
  const aiMsg = {
    id: makeId(),
    role: "assistant",
    badgeText: "Running...",
    badgeClass: preferLocal ? "badge-on-device" : "badge-cloud",
    privacySummary: "",
    latencyText: "0.0s…",
    reason: route.reason,
    text: preferLocal ? "Checking local Gemini Nano…" : "Masking identifiers & connecting to Cloud…",
    createdAt: Date.now(),
  };

  chat.messages.push(aiMsg);
  saveNotes();
  renderAll();

  activeAbortController = new AbortController();
  const { signal } = activeAbortController;
  setRunning(true, aiMsg);

  try {
    let res;
    let privacySummary = "";
    let extraReason = "";

    if (
      route.mode === "ONLY_ON_DEVICE" &&
      text.length >= maxOnDeviceChars &&
      (task === "summarize" || task === "todos")
    ) {
      res = await runChunkedOnDevice({
        text,
        task,
        signal,
        onProgress: (msg) => {
          aiMsg.text = msg;
          renderThread();
        },
      });
      extraReason = ` (Split into ${res.chunks} chunks on-device.)`;
    } else {
      let inputText = text;
      if (route.mode === "ONLY_IN_CLOUD" || route.mode === "PREFER_IN_CLOUD") {
        const clean = sanitizeForCloud(text);
        inputText = clean.sanitizedText;
        privacySummary = clean.summary;
      }

      const updateLiveText = (statusText, isStream = false) => {
        aiMsg.text = statusText;
        const bodies = chatThreadEl.querySelectorAll(".result-body");
        const lastBody = bodies[bodies.length - 1];
        if (lastBody) {
          if (isStream) {
            lastBody.classList.remove("is-thinking");
            lastBody.innerHTML = renderMarkdownSafe(statusText);
          } else {
            lastBody.textContent = statusText;
          }
          scrollFeedToBottom();
        }
      };

      res = await runAI({
        prompt: buildPrompt(task, inputText),
        mode: route.mode,
        signal,
        onStatus: (s) => updateLiveText(s, false),
        onStream: task === "quiz" ? undefined : (partial) => updateLiveText(partial, true),
        onDownloadProgress: (pct) => {
          updateLiveText(`Downloading Gemini Nano locally: ${pct}%`, false);
        },
      });
    }

    const savedBytes = new Blob([text, res.text]).size;
    recordStat(res.source, res.ms, savedBytes);

    const isOnDevice = res.source === "on-device";
    const reasonText =
      route.mode === "PREFER_ON_DEVICE" && !isOnDevice
        ? `${route.reason} (Fell back to cloud.)`
        : `${route.reason}${extraReason}`;

    aiMsg.badgeText = isOnDevice ? "Gemini Nano" : "Gemini 3.5 Flash-Lite";
    aiMsg.badgeClass = isOnDevice ? "badge-on-device" : "badge-cloud";
    aiMsg.privacySummary = !isOnDevice ? privacySummary : "";
    aiMsg.latencyText = formatSec(res.ms);
    aiMsg.reason = reasonText;
    aiMsg.text = res.text;
    if (task === "quiz") {
      const parsedQuiz = parseQuizItems(res.text);
      if (parsedQuiz) aiMsg.quizItems = parsedQuiz;
    }

    if (task === "title" && res.text.trim()) {
      chat.title = res.text.trim().replace(/^["']|["']$/g, "").slice(0, 60);
      chat.autoTitled = false;
      titleInput.value = chat.title;
    }

    chat.updatedAt = Date.now();
    saveNotes();
    renderAll();
  } catch (err) {
    if (err?.name === "AbortError") {
      aiMsg.badgeText = "Cancelled";
      aiMsg.badgeClass = "badge-blocked";
      aiMsg.reason = "Stopped by user. Your chat is saved locally.";
      aiMsg.text = "";
    } else {
      aiMsg.badgeText = "Error";
      aiMsg.badgeClass = "badge-blocked";
      aiMsg.reason = route.reason;
      aiMsg.text = err?.message || "AI request failed. Your chat is saved locally.";
    }
    saveNotes();
    renderThread();
  } finally {
    activeAbortController = null;
    setRunning(false);
  }
}

navHomeBtn.addEventListener("click", () => showView("home"));
navWorkspaceBtn.addEventListener("click", () => showView("workspace"));
launchWorkspaceBtn.addEventListener("click", () => showView("workspace"));
footerLaunchBtn?.addEventListener("click", () => showView("workspace"));

simOfflineToggle.addEventListener("change", () => {
  if (mobileSimOfflineToggle) mobileSimOfflineToggle.checked = simOfflineToggle.checked;
  updateOfflineBanner();
});
mobileSimOfflineToggle?.addEventListener("change", () => {
  simOfflineToggle.checked = mobileSimOfflineToggle.checked;
  updateOfflineBanner();
});
window.addEventListener("resize", syncViewLayout);

mobileMenuBtn.addEventListener("click", () => {
  setDrawerOpen(!sidebar.classList.contains("drawer-open"));
});
closeDrawerBtn.addEventListener("click", () => setDrawerOpen(false));
drawerBackdrop.addEventListener("click", () => setDrawerOpen(false));

taskMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setPopoverOpen(taskPopover.hidden);
});

modelMenuBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  setModelPopoverOpen(modelPopover.hidden);
});

modelOptBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectModel(btn.dataset.model);
    setModelPopoverOpen(false);
  });
});

document.addEventListener("click", (e) => {
  if (!taskPopover.hidden && !taskPopover.contains(e.target) && e.target !== taskMenuBtn) {
    setPopoverOpen(false);
  }
  if (modelPopover && !modelPopover.hidden && !modelPopover.contains(e.target) && !modelMenuBtn?.contains(e.target)) {
    setModelPopoverOpen(false);
  }
});

newNoteBtn.addEventListener("click", () => {
  const note = createNote({ isPrivate: profile.defaultPrivate });
  notes.unshift(note);
  activeId = note.id;
  saveNotes();
  if (!homeView.hidden) showView("workspace");
  else setDrawerOpen(false);
  renderAll();
  contentInput.focus();
});

deleteNoteBtn.addEventListener("click", () => {
  if (notes.length === 1) {
    notes[0] = createNote();
    activeId = notes[0].id;
  } else {
    notes = notes.filter((n) => n.id !== activeId);
    activeId = notes[0].id;
  }
  saveNotes();
  renderAll();
});

renameNoteBtn?.addEventListener("click", () => {
  titleInput.focus();
  titleInput.select();
});

resetStatsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  stats = { ...DEFAULT_STATS };
  saveStats();
  renderStats();
});

statsCard.addEventListener("click", () => {
  setDrawerOpen(false);
  renderStats();
  statsModal.showModal();
});

statsCard.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    setDrawerOpen(false);
    renderStats();
    statsModal.showModal();
  }
});

closeStatsModal.addEventListener("click", () => statsModal.close());
statsModal.addEventListener("click", (e) => {
  if (e.target === statsModal) statsModal.close();
});

titleInput.addEventListener("input", () => {
  const note = getActiveNote();
  if (!note) return;
  note.title = titleInput.value;
  note.autoTitled = false;
  note.updatedAt = Date.now();
  saveNotes();
  renderSidebar();
});

contentInput.addEventListener("input", () => {
  const note = getActiveNote();
  if (!note) return;
  note.draft = contentInput.value;
  note.updatedAt = Date.now();
  charCountEl.textContent = `${note.draft.trim().length} chars`;
  autoResizeEditor();
  saveNotes();
});

contentInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    handleRun();
  }
});

privateToggle.addEventListener("change", () => {
  const note = getActiveNote();
  if (!note) return;
  note.isPrivate = privateToggle.checked;
  note.updatedAt = Date.now();
  saveNotes();
  renderSidebar();
});

actionBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectTask(btn.dataset.task);
    if (btn.dataset.task !== "translate") {
      setPopoverOpen(false);
    }
  });
});

translateLangEl.addEventListener("change", () => {
  selectTask("translate");
  setPopoverOpen(false);
});

runAiBtn.addEventListener("click", handleRun);

cancelAiBtn.addEventListener("click", () => {
  if (activeAbortController) {
    activeAbortController.abort();
  }
});

window.addEventListener("online", updateOfflineBanner);
window.addEventListener("offline", updateOfflineBanner);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Fetch Remote Config threshold and pre-warm on-device model in the background.
getMaxOnDeviceChars().then((val) => {
  maxOnDeviceChars = val;
  renderStats();
});
initOnDeviceModel()
  .then(refreshNanoStatus)
  .catch(refreshNanoStatus);
refreshNanoStatus();

function initScrollReveals() {
  const targets = document.querySelectorAll(".reveal-drop");
  if (!targets.length) return;
  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { root: homeView, threshold: 0.12, rootMargin: "0px 0px -24px 0px" }
  );
  targets.forEach((el) => observer.observe(el));
}

const DEMO_STEPS = [
  {
    badge: "Step 1 of 3",
    title: "1. Paste your notes & tap Send",
    desc: "Type or paste any class note below and tap Send. Short notes stay right on your device.",
    pill: "Summarize · On-Device",
    inputLabel: "YOU TYPE",
    typed: "Photosynthesis turns sunlight, water, and CO2 into glucose and oxygen inside chloroplasts.",
    outBadge: "On-device",
    outBadgeClass: "badge-on-device",
    outStat: "240 ms · 0 KB data",
    outText: "• Plants use sunlight + water + CO2 to make glucose.\n• Happens inside chloroplasts and releases oxygen.",
  },
  {
    badge: "Step 2 of 3",
    title: "2. Pick any study tool with +",
    desc: "Tap the + button to switch between Summaries, Quiz Me flashcards, To-dos, or Translate.",
    pill: "+ → Quiz Me (Flashcards)",
    inputLabel: "YOU PICK QUIZ ME",
    typed: "Newton's 2nd Law: Force equals mass times acceleration (F = m × a).",
    outBadge: "On-device",
    outBadgeClass: "badge-on-device",
    outStat: "Flashcards ready",
    outText: "Q: What is Newton's 2nd Law formula?\nA: F = m × a (Force = mass × acceleration).",
  },
  {
    badge: "Step 3 of 3",
    title: "3. Your secrets stay protected",
    desc: "Turn on Private to lock notes on your phone, or let HybridNotes hide emails & IDs before cloud calls.",
    pill: "Identifier Masking",
    inputLabel: "BEFORE CLOUD CALL",
    typed: "Email sara@uni.edu or student ID 20264819 for lab notes.",
    outBadge: "Cloud · Masked",
    outBadgeClass: "badge-cloud",
    outStat: "1 email, 1 ID masked",
    outText: "Sent safely as: Email [REDACTED_EMAIL] or student ID [REDACTED_ID] for lab notes.",
  },
];

let demoIndex = 0;
let demoTimer = null;

function stopDemoTyping() {
  if (demoTimer) {
    clearTimeout(demoTimer);
    demoTimer = null;
  }
}

function playDemoTyping(step) {
  stopDemoTyping();
  demoTypedText.textContent = "";
  demoOutputBox.classList.remove("show");

  let i = 0;
  function tick() {
    if (!demoModal?.open) return;
    if (i < step.typed.length) {
      demoTypedText.textContent += step.typed[i];
      i += 1;
      demoTimer = setTimeout(tick, 22);
    } else {
      demoTimer = setTimeout(() => {
        if (!demoModal?.open) return;
        demoOutputBox.classList.add("show");
      }, 260);
    }
  }
  demoTimer = setTimeout(tick, 180);
}

function renderDemoStep(idx) {
  demoIndex = Math.max(0, Math.min(idx, DEMO_STEPS.length - 1));
  const step = DEMO_STEPS[demoIndex];
  demoStepBadge.textContent = step.badge;
  demoStepTitle.textContent = step.title;
  demoStepDesc.textContent = step.desc;
  demoStagePill.textContent = step.pill;
  demoInputLabel.textContent = step.inputLabel;
  demoOutBadge.textContent = step.outBadge;
  demoOutBadge.className = `badge ${step.outBadgeClass}`;
  demoOutStat.textContent = step.outStat;
  demoOutText.textContent = step.outText;

  demoPrevBtn.hidden = demoIndex === 0;
  demoNextBtn.textContent = demoIndex === DEMO_STEPS.length - 1 ? "Start Studying →" : "Next →";

  demoDots.innerHTML = "";
  DEMO_STEPS.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `carousel-dot${i === demoIndex ? " active" : ""}`;
    dot.setAttribute("aria-label", `Step ${i + 1}`);
    dot.addEventListener("click", () => renderDemoStep(i));
    demoDots.appendChild(dot);
  });

  playDemoTyping(step);
}

function openDemoModal(startIdx = 0) {
  if (!demoModal) return;
  if (!demoModal.open) demoModal.showModal();
  renderDemoStep(startIdx);
}

function closeDemoModal() {
  stopDemoTyping();
  localStorage.setItem(TOUR_KEY, "1");
  if (demoModal?.open) demoModal.close();
  renderThread();
  contentInput.focus();
}

demoSkipBtn?.addEventListener("click", closeDemoModal);
demoPrevBtn?.addEventListener("click", () => renderDemoStep(demoIndex - 1));
demoNextBtn?.addEventListener("click", () => {
  if (demoIndex < DEMO_STEPS.length - 1) {
    renderDemoStep(demoIndex + 1);
  } else {
    closeDemoModal();
  }
});
demoModal?.addEventListener("click", (e) => {
  if (e.target === demoModal) closeDemoModal();
});
demoModal?.addEventListener("cancel", () => {
  stopDemoTyping();
  localStorage.setItem(TOUR_KEY, "1");
});

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    // Ignore malformed profile.
  }
  return { ...DEFAULT_PROFILE };
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function getInitials(name) {
  const parts = String(name || "S").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function renderProfile() {
  const initials = getInitials(profile.name);
  if (profileAvatarInitials) profileAvatarInitials.textContent = initials;
  if (profileModalInitials) profileModalInitials.textContent = initials;
  if (profileNameInput && profileNameInput.value !== profile.name) {
    profileNameInput.value = profile.name;
  }
  if (profileFocusInput && profileFocusInput.value !== profile.focus) {
    profileFocusInput.value = profile.focus;
  }
  if (profileDefaultPrivate) {
    profileDefaultPrivate.checked = Boolean(profile.defaultPrivate);
  }

  let totalBytes = 0;
  for (const key of [NOTES_KEY, STATS_KEY, PROFILE_KEY, TOUR_KEY]) {
    const val = localStorage.getItem(key) || "";
    totalBytes += new Blob([key, val]).size;
  }
  const usedKb = (totalBytes / 1024).toFixed(1);
  const quotaKb = 5120;
  const pct = Math.min(100, Math.max(1, Math.round((totalBytes / (quotaKb * 1024)) * 100)));
  const msgCount = notes.reduce((acc, n) => acc + (n.messages?.length || 0), 0);

  if (profileQuotaSummary) {
    profileQuotaSummary.textContent = `${usedKb} KB / 5,120 KB localStorage`;
  }
  if (profileChatsCount) {
    profileChatsCount.textContent = `${notes.length} chats · ${msgCount} messages`;
  }
  if (profileQuotaBar) {
    profileQuotaBar.style.width = `${pct}%`;
  }

  const totalRuns = stats.onDeviceCount + stats.cloudCount;
  const onPct = totalRuns ? Math.round((stats.onDeviceCount / totalRuns) * 100) : 0;
  const savedKb = (stats.bytesSaved / 1024).toFixed(1);
  if (profileSavingsLine) {
    profileSavingsLine.textContent = `${onPct}% on-device · ${stats.cloudCallsAvoided} cloud calls avoided · ${savedKb} KB mobile data saved`;
  }
}

profileBtn?.addEventListener("click", () => {
  renderProfile();
  profileModal?.showModal();
});
closeProfileModal?.addEventListener("click", () => profileModal?.close());
profileModal?.addEventListener("click", (e) => {
  if (e.target === profileModal) profileModal.close();
});

profileNameInput?.addEventListener("input", () => {
  profile.name = profileNameInput.value || "Student";
  saveProfile();
  renderProfile();
});
profileFocusInput?.addEventListener("input", () => {
  profile.focus = profileFocusInput.value;
  saveProfile();
});
profileDefaultPrivate?.addEventListener("change", () => {
  profile.defaultPrivate = profileDefaultPrivate.checked;
  saveProfile();
});

profileExportBtn?.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
    stats,
    chats: notes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hybridnotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

profileTourBtn?.addEventListener("click", () => {
  profileModal?.close();
  showView("workspace");
  openDemoModal(0);
});

profileStatsBtn?.addEventListener("click", () => {
  profileModal?.close();
  renderStats();
  statsModal?.showModal();
});

profileClearBtn?.addEventListener("click", () => {
  if (!window.confirm("Clear all local chats, routing stats, and profile on this device?")) return;
  localStorage.removeItem(NOTES_KEY);
  localStorage.removeItem(STATS_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(TOUR_KEY);
  profile = { ...DEFAULT_PROFILE };
  stats = { ...DEFAULT_STATS };
  notes = loadNotes();
  activeId = notes[0]?.id || null;
  renderAll();
  renderProfile();
  profileModal?.close();
});

initCarousel();
initScrollReveals();
syncViewLayout();
updateOfflineBanner();
updateSelectedChip();
renderAll();