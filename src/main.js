import {
  runAI,
  initOnDeviceModel,
  getOnDeviceStatus,
  isMobileDevice,
  getMaxOnDeviceChars,
  runChunkedOnDevice,
  sanitizeForCloud,
} from "./ai.js";
import { decideRoute } from "./router.js";
import {
  getDueStudyLoopItems,
  getStudyLoopItems,
  getStudyLoopSummary,
  getWeakSpotItems,
  recordReviewOutcome,
  scheduleMissedQuizItem,
} from "./study-loop.js";
import {
  QUIZ_RESPONSE_SCHEMA,
  parseQuizJson,
  parseLegacyQuizText,
} from "./quiz.js";
import { extractText } from "./vision.js";
import { getStorageInfo, requestPersistentStorage } from "./model-store.js";

const NOTES_KEY = "hybridnotes_notes";
const STATS_KEY = "hybridnotes_stats";
const TOUR_KEY = "hybridnotes_tour_done";
const PROFILE_KEY = "hybridnotes_profile";
const THEME_KEY = "hybridnotes_theme";
const themeToggleBtns = document.querySelectorAll(".theme-toggle");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  const isLight = theme === "light";
  document.documentElement.dataset.theme = isLight ? "light" : "dark";
  themeColorMeta?.setAttribute("content", isLight ? "#f5f7fb" : "#070505");
  const label = `Switch to ${isLight ? "dark" : "light"} theme`;
  themeToggleBtns.forEach((button) => {
    button.setAttribute("aria-label", label);
    button.title = label;
  });
}

applyTheme(localStorage.getItem(THEME_KEY));
themeToggleBtns.forEach((button) => {
  button.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
});

const DEFAULT_PROFILE = {
  name: "Student",
  focus: "",
  defaultPrivate: false,
  routingTelemetry: true,
};
const DEFAULT_TITLE = "Untitled note";

const DEFAULT_STATS = {
  onDeviceCount: 0,
  cloudCount: 0,
  onDeviceTotalMs: 0,
  cloudTotalMs: 0,
  cloudCallsAvoided: 0,
  estimatedTextBytes: 0,
  totalMaskedCount: 0,
};

const TASK_LABELS = {
  auto: "Auto",
  summarize: "Summarize",
  quiz: "Quiz Me",
  grammar: "Fix grammar",
  title: "Suggest title",
  todos: "Extract to-dos",
  "deep-analyze": "Deep Analyze",
  translate: "Translate",
};

const navHomeBtn = document.getElementById("nav-home-btn");
const brandHomeBtn = document.getElementById("brand-home-btn");
const navFeaturesBtn = document.getElementById("nav-features-btn");
const navPrivacyBtn = document.getElementById("nav-privacy-btn");
const navOssBtn = document.getElementById("nav-oss-btn");
const navWorkspaceBtn = document.getElementById("nav-workspace-btn");
const launchWorkspaceBtn = document.getElementById("launch-workspace-btn");
const footerLaunchBtn = document.getElementById("footer-launch-btn");
const footerPrivacyBtn = document.getElementById("footer-privacy-btn");
const homeView = document.getElementById("home-view");
const privacyView = document.getElementById("privacy-view");
const workspaceView = document.getElementById("workspace-view");
const workspaceMain = workspaceView.querySelector(".workspace");
const settingsView = document.getElementById("settings-view");
const settingsMenuBtn = document.getElementById("settings-menu-btn");
const settingsBackBtn = document.getElementById("settings-back-btn");
const settingsTabs = document.querySelectorAll(".settings-tab");
const settingsPanels = document.querySelectorAll(".settings-panel");
const simOfflineToggle = document.getElementById("sim-offline-toggle");
const mobileSimOfflineToggle = document.getElementById("mobile-sim-offline-toggle");
const nanoStatusPill = document.getElementById("nano-status-pill");
const profileNanoStatusPill = document.getElementById("profile-nano-status-pill");

const carouselTrack = document.getElementById("carousel-track");
const carouselPrev = document.getElementById("carousel-prev");
const carouselNext = document.getElementById("carousel-next");
const carouselDots = document.getElementById("carousel-dots");
const carouselToggle = document.getElementById("carousel-toggle");

const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const closeDrawerBtn = document.getElementById("close-drawer-btn");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const sidebar = document.getElementById("sidebar");
const sidebarHomeBtn = document.getElementById("sidebar-home-btn");

const offlineBanner = document.getElementById("offline-banner");
const noteListEl = document.getElementById("note-list");
const chatSearchInput = document.getElementById("chat-search-input");
const studyLoopBtn = document.getElementById("study-loop-btn");
const studyLoopCountEl = document.getElementById("study-loop-count");
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

const resetStatsBtn = document.getElementById("reset-stats-btn");
const statsSummaryEl = document.getElementById("stats-summary");
const sidebarOnDevicePct = document.getElementById("sidebar-ondevice-pct");
const statOnDeviceMeta = document.getElementById("stat-ondevice-meta");
const statCloudMeta = document.getElementById("stat-cloud-meta");
const statOnDeviceBar = document.getElementById("stat-ondevice-bar");
const statCloudBar = document.getElementById("stat-cloud-bar");

const modalOnDevicePct = document.getElementById("modal-ondevice-pct");
const modalAvoided = document.getElementById("modal-avoided");
const modalKbSaved = document.getElementById("modal-kb-saved");
const modalThreshold = document.getElementById("modal-threshold");
const modalOnDeviceDetail = document.getElementById("modal-ondevice-detail");
const modalCloudDetail = document.getElementById("modal-cloud-detail");

const studyLoopModal = document.getElementById("study-loop-modal");
const closeStudyLoopBtn = document.getElementById("close-study-loop-btn");
const studyLoopSummaryEl = document.getElementById("study-loop-summary");
const studyLoopEmptyEl = document.getElementById("study-loop-empty");
const studyLoopCreateQuizBtn = document.getElementById("study-loop-create-quiz-btn");
const studyReviewCardEl = document.getElementById("study-review-card");
const studyReviewProgressEl = document.getElementById("study-review-progress");
const studyReviewNoteEl = document.getElementById("study-review-note");
const studyReviewQuestionEl = document.getElementById("study-review-question");
const studyReviewOptionsEl = document.getElementById("study-review-options");
const studyReviewFeedbackEl = document.getElementById("study-review-feedback");
const studyReviewNextBtn = document.getElementById("study-review-next-btn");

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
const studyLoopDemoOptions = document.querySelectorAll(".study-loop-demo-option");
const studyLoopDemoFeedback = document.getElementById("study-loop-demo-feedback");
const studyLoopDemoResetBtn = document.getElementById("study-loop-demo-reset");
const studyLoopDemoStartBtn = document.getElementById("study-loop-demo-start-btn");

const profileBtn = document.getElementById("profile-btn");
const profileAvatarInitials = document.getElementById("profile-avatar-initials");
const settingsAvatarInitials = document.getElementById("settings-avatar-initials");
const profileNameInput = document.getElementById("profile-name-input");
const profileFocusInput = document.getElementById("profile-focus-input");
const profileDefaultPrivate = document.getElementById("profile-default-private");
const profileRoutingTelemetry = document.getElementById("profile-routing-telemetry");
const profileQuotaSummary = document.getElementById("profile-quota-summary");
const profileChatsCount = document.getElementById("profile-chats-count");
const profileQuotaBar = document.getElementById("profile-quota-bar");
const profileExportBtn = document.getElementById("profile-export-btn");
const profileImportBtn = document.getElementById("profile-import-btn");
const profileImportInput = document.getElementById("profile-import-input");
const profileTourBtn = document.getElementById("profile-tour-btn");
const profileClearBtn = document.getElementById("profile-clear-btn");
const sidebarStatsBtn = document.getElementById("sidebar-stats-btn");
const sidebarProfileBtn = document.getElementById("sidebar-profile-btn");
const sidebarAvatarInitials = document.getElementById("sidebar-avatar-initials");
const sidebarProfileName = document.getElementById("sidebar-profile-name");

const nanoDownloadModal = document.getElementById("nano-download-modal");
const nanoDlClose = document.getElementById("nano-dl-close");
const nanoDlSkip = document.getElementById("nano-dl-skip");
const nanoDlConfirm = document.getElementById("nano-dl-confirm");
const nanoDlProgressWrap = document.getElementById("nano-dl-progress-wrap");
const nanoDlStatusText = document.getElementById("nano-dl-status-text");
const nanoDlPct = document.getElementById("nano-dl-pct");
const nanoDlBar = document.getElementById("nano-dl-bar");

const nanoHelpModal = document.getElementById("nano-help-modal");
const nanoHelpClose = document.getElementById("nano-help-close");
const nanoHelpOk = document.getElementById("nano-help-ok");
const nanoHelpAutoBtn = document.getElementById("nano-help-auto-btn");
const nanoHelpSub = document.getElementById("nano-help-sub");

let notes = loadNotes();
let activeId = notes[0]?.id || null;
let stats = loadStats();
let profile = loadProfile();
let maxOnDeviceChars = 1500;
let selectedTask = "auto";
let selectedModel = "auto";
let activeAbortController = null;
let pendingAttachment = null;
let slideIndex = 0;
let carouselPaused = false;
let studyReviewQueue = [];
let studyReviewIndex = 0;
let chatSearchQuery = "";

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function initCarousel() {
  const slides = carouselTrack?.children?.length || 0;
  if (!slides || !carouselDots) return;

  carouselDots.innerHTML = "";
  for (let i = 0; i < slides; i += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `carousel-dot${i === 0 ? " active" : ""}`;
    dot.setAttribute("aria-label", `Feature ${i + 1}`);
    dot.addEventListener("click", () => goToSlide(i));
    carouselDots.appendChild(dot);
  }

  carouselPrev?.addEventListener("click", () => goToSlide(slideIndex - 1));
  carouselNext?.addEventListener("click", () => goToSlide(slideIndex + 1));
  carouselToggle?.addEventListener("click", () => {
    carouselPaused = !carouselPaused;
    carouselToggle.textContent = carouselPaused ? "Play" : "Pause";
  });

  setInterval(() => {
    if (!homeView.hidden && !carouselPaused) goToSlide(slideIndex + 1);
  }, 5000);
}

function goToSlide(idx) {
  const slides = carouselTrack?.children?.length || 0;
  if (!slides || !carouselDots) return;
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
  settingsMenuBtn?.setAttribute("aria-expanded", String(open));
  if (window.matchMedia("(max-width: 820px)").matches) {
    closeDrawerBtn.setAttribute("aria-expanded", String(open));
    closeDrawerBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
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
  const isWorkspace = !workspaceView.hidden && !workspaceView.classList.contains("mobile-drawer-host");
  const isMobile = window.matchMedia("(max-width: 820px)").matches;
  if (!isWorkspace && isMobile && ( !homeView.hidden || (privacyView && !privacyView.hidden) )) {
    workspaceView.hidden = false;
    workspaceView.classList.add("mobile-drawer-host");
  } else if (homeView.hidden && (!privacyView || privacyView.hidden)) {
    workspaceView.classList.remove("mobile-drawer-host");
    workspaceView.hidden = false;
  } else {
    workspaceView.classList.remove("mobile-drawer-host");
    workspaceView.hidden = true;
  }
}

function showView(view, scrollTargetId = null) {
  const isHome = view === "home";
  const isPrivacy = view === "privacy";
  const isSettings = view === "settings";
  const isWorkspace = view === "workspace" || isSettings;

  document.body.classList.toggle("workspace-active", isWorkspace);
  homeView.hidden = !isHome;
  if (privacyView) privacyView.hidden = !isPrivacy;
  workspaceView.classList.remove("mobile-drawer-host");
  workspaceView.hidden = !isWorkspace;
  workspaceMain.hidden = isSettings;
  settingsView.hidden = !isSettings;

  navHomeBtn.classList.toggle("active", isHome);
  navPrivacyBtn?.classList.toggle("active", isPrivacy);
  navWorkspaceBtn.classList.toggle("active", isWorkspace);
  navWorkspaceBtn.textContent = isWorkspace ? "Workspace" : "Open workspace";
  navHomeBtn.setAttribute("aria-selected", String(isHome));
  navPrivacyBtn?.setAttribute("aria-selected", String(isPrivacy));
  navWorkspaceBtn.setAttribute("aria-selected", String(isWorkspace));

  setDrawerOpen(false);
  setPopoverOpen(false);
  setModelPopoverOpen(false);
  if (!isWorkspace) syncViewLayout();

  if (scrollTargetId && isHome) {
    requestAnimationFrame(() => {
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (isPrivacy) renderPrivacyTester();

  if (isSettings) {
    renderProfile();
    renderStats();
  }

  if (isWorkspace && !isSettings) {
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
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return DEFAULT_TITLE;

  // Prefer a meaningful comment or non-import line if code is pasted
  const commentLine = lines.find((l) => /^(?:\/\/|#|\/\*)\s*[A-Za-z0-9]/.test(l));
  if (commentLine) {
    const clean = commentLine.replace(/^(?:\/\/+|#+|\/\*+|\*+)\s*/, "").replace(/\*\/$/, "").trim();
    if (clean.length >= 3) {
      return clean.length > 36 ? `${clean.slice(0, 36)}…` : clean;
    }
  }

  const funcMatch = content.match(
    /(?:public|private|protected|static|async|export|function|def|class)\s+(?:[A-Za-z0-9_<>[\]]+\s+)?([A-Za-z_][A-Za-z0-9_]{2,})\s*[({]/
  );
  const meaningful = lines.find(
    (l) => !/^(?:import\s|package\s|#include\s|using\s|from\s+\S+\s+import|[{};]+$)/.test(l)
  );

  if (funcMatch && lines.some((l) => /^(?:import\s|#include|package\s|def\s|function\s|class\s)/.test(l))) {
    const name = funcMatch[1];
    return `Code: ${name}`;
  }

  const candidate = (meaningful || lines[0])
    .replace(/^[#*>\-•]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate) return DEFAULT_TITLE;
  if (candidate.length <= 36) return candidate;
  const cut = candidate.slice(0, 36);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 18 ? cut.slice(0, lastSpace) : cut}…`;
}

function selectTask(task) {
  selectedTask = task;
  actionBtns.forEach((btn) => {
    const isSelected = btn.dataset.task === task;
    btn.classList.toggle("active", isSelected);
    btn.setAttribute("aria-checked", String(isSelected));
  });
  document.querySelectorAll(".chat-empty-action").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.task === task));
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
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch (err) {
    console.warn("Storage quota reached while saving notes:", err);
  }
  updateStudyLoopButton();
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          ...DEFAULT_STATS,
          ...parsed,
          estimatedTextBytes: Number.isFinite(parsed.estimatedTextBytes)
            ? parsed.estimatedTextBytes
            : Number.isFinite(parsed.bytesSaved)
              ? parsed.bytesSaved
              : 0,
        };
      }
    }
  } catch {
    // Ignore malformed stats.
  }
  return { ...DEFAULT_STATS };
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordStat(source, ms, estimatedTextBytes = 0, maskedCount = 0) {
  if (!profile.routingTelemetry) return;
  if (source === "on-device") {
    stats.onDeviceCount += 1;
    stats.onDeviceTotalMs += ms;
    stats.cloudCallsAvoided += 1;
    stats.estimatedTextBytes += estimatedTextBytes;
  } else {
    stats.cloudCount += 1;
    stats.cloudTotalMs += ms;
    stats.totalMaskedCount = (stats.totalMaskedCount || 0) + (maskedCount || 0);
  }
  saveStats();
  renderStats();
}

function renderStats() {
  if (profile.routingTelemetry === false) {
    stats = { ...DEFAULT_STATS };
  }
  const total = stats.onDeviceCount + stats.cloudCount;
  const onPct = total ? Math.round((stats.onDeviceCount / total) * 100) : 0;
  const cloudPct = total ? 100 - onPct : 0;
  const onAvg = stats.onDeviceCount
    ? Math.round(stats.onDeviceTotalMs / stats.onDeviceCount)
    : null;
  const cloudAvg = stats.cloudCount
    ? Math.round(stats.cloudTotalMs / stats.cloudCount)
    : null;
  const estimatedKb = (stats.estimatedTextBytes / 1024).toFixed(1);

  statsSummaryEl.textContent = `${onPct}% on-device · an estimated ${stats.cloudCallsAvoided} cloud calls avoided · ~${estimatedKb} KB text`;
  statsSummaryEl.title =
    "Estimated UTF-8 size of note and response text for on-device runs; not total network usage.";
  if (sidebarOnDevicePct) sidebarOnDevicePct.textContent = `${onPct}%`;
  statOnDeviceMeta.textContent = `${stats.onDeviceCount} local`;
  statCloudMeta.textContent = `${stats.cloudCount} cloud`;
  statOnDeviceBar.style.width = `${onPct}%`;
  statCloudBar.style.width = `${cloudPct}%`;

  document.querySelectorAll(".hn-route-bar").forEach((bar) => {
    const [onDeviceSegment, cloudSegment] = bar.children;
    if (onDeviceSegment && cloudSegment) {
      onDeviceSegment.style.width = `${onPct}%`;
      cloudSegment.style.width = `${cloudPct}%`;
    }
  });
  document.querySelectorAll(".hn-route-summary").forEach((summary) => {
    summary.textContent = total
      ? `${stats.onDeviceCount} on-device · ${stats.cloudCount} cloud runs`
      : "Run a task to see your route counts.";
  });

  modalOnDevicePct.textContent = `${onPct}%`;
  modalAvoided.textContent = String(stats.cloudCallsAvoided);
  modalKbSaved.textContent = `~${estimatedKb} KB`;
  modalThreshold.textContent = `${maxOnDeviceChars} chars`;
  modalOnDeviceDetail.textContent = `${stats.onDeviceCount} runs · ${onAvg !== null ? `${formatSec(onAvg)} avg` : "—"}`;
  modalCloudDetail.textContent = `${stats.cloudCount} runs · ${cloudAvg !== null ? `${formatSec(cloudAvg)} avg` : "—"}`;
  const modalMaskedEl = document.getElementById("modal-masked-total");
  const compareOnEl = document.getElementById("compare-ondevice-stats");
  const compareCloudEl = document.getElementById("compare-cloud-stats");
  const maskedTotal = stats.totalMaskedCount || 0;
  if (modalMaskedEl) {
    modalMaskedEl.textContent = `${maskedTotal} PII ${maskedTotal === 1 ? "identifier" : "identifiers"} masked locally`;
  }
  if (compareOnEl) {
    compareOnEl.textContent = `${stats.onDeviceCount} runs · ${onAvg !== null ? `${formatSec(onAvg)} avg` : "—"}`;
  }
  if (compareCloudEl) {
    compareCloudEl.textContent = `${stats.cloudCount} runs · ${cloudAvg !== null ? `${formatSec(cloudAvg)} avg` : "—"}`;
  }
}

const GEMINI_SPARKLE_SVG =
  '<svg class="inline-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.4 5.2 4.8 9.6 10 10-5.2.4-9.6 4.8-10 10-.4-5.2-4.8-9.6-10-10 5.2-.4 9.6-4.8 10-10z"/></svg>';
const DEVICE_CHIP_SVG =
  '<svg class="inline-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>';

let lastNanoStatus = "unavailable";

async function refreshNanoStatus() {
  const mobile = isMobileDevice();
  const status = await getOnDeviceStatus();
  lastNanoStatus = status;
  const pills = [nanoStatusPill, profileNanoStatusPill].filter(Boolean);
  for (const pill of pills) {
    pill.classList.remove("nano-ready", "nano-warn", "nano-clickable");
    if (status === "available") {
      pill.innerHTML = `${DEVICE_CHIP_SVG}<span>Offline AI ready</span>`;
      pill.classList.add("nano-ready");
    } else if (status === "downloading" && !mobile) {
      pill.innerHTML = `${DEVICE_CHIP_SVG}<span>Downloading Offline AI…</span>`;
      pill.classList.add("nano-warn", "nano-clickable");
    } else if (status === "downloadable" && !mobile) {
      pill.innerHTML = `${DEVICE_CHIP_SVG}<span>Enable Offline AI</span>`;
      pill.classList.add("nano-warn", "nano-clickable");
      pill.title = "Click to download the ~2–4 GB offline model once";
    } else {
      const statusText = mobile
        ? "Cloud ready · on-device AI unavailable"
        : "Cloud AI ready (PII masked) · On-device unavailable";
      pill.innerHTML = `${DEVICE_CHIP_SVG}<span>${statusText}</span>`;
      pill.classList.add("nano-warn", "nano-clickable");
      pill.title = "Click to see why on-device AI is unavailable here";
    }
  }

  const nanoOpt = document.querySelector('.model-opt[data-model="nano"] span');
  if (nanoOpt) {
    nanoOpt.textContent =
      status === "available" || status === "downloadable" || status === "downloading"
        ? "Gemini Nano (On-device)"
        : "Gemini Nano (Unavailable here)";
  }
}

function openNanoDownloadModal() {
  if (!nanoDownloadModal) return;
  if (lastNanoStatus === "unavailable") {
    setDrawerOpen(false);
    if (nanoHelpSub) {
      nanoHelpSub.textContent = isMobileDevice()
        ? "Chrome's built-in Gemini Nano currently runs only on Desktop Chrome, not on mobile browsers. Switch to Auto mode below to study right now using Cloud Flash-Lite (with identifiers masked)."
        : "Chrome's built-in Gemini Nano isn't active on this profile yet. Follow these steps to enable it, or switch to Auto mode to use Cloud Flash-Lite right away.";
    }
    nanoHelpModal?.showModal();
    return;
  }
  if (isMobileDevice()) return;
  if (lastNanoStatus !== "downloadable" && lastNanoStatus !== "downloading") return;
  setDrawerOpen(false);
  nanoDlConfirm.disabled = false;
  nanoDlConfirm.textContent = "Enable Offline AI (~2–4 GB)";
  nanoDlProgressWrap.hidden = lastNanoStatus !== "downloading";
  nanoDownloadModal.showModal();
}

nanoStatusPill?.addEventListener("click", openNanoDownloadModal);
profileNanoStatusPill?.addEventListener("click", openNanoDownloadModal);
nanoDlClose?.addEventListener("click", () => nanoDownloadModal?.close());
nanoHelpClose?.addEventListener("click", () => nanoHelpModal?.close());
document.querySelectorAll(".copy-flag-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy || "");
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1400);
    } catch {
      // Clipboard unavailable.
    }
  });
});
nanoHelpOk?.addEventListener("click", () => nanoHelpModal?.close());
nanoHelpAutoBtn?.addEventListener("click", () => {
  selectModel("auto");
  nanoHelpModal?.close();
});
nanoHelpModal?.addEventListener("click", (e) => {
  if (e.target === nanoHelpModal) nanoHelpModal.close();
});
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

const TRASH_SVG =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4.5 6h11M8 6V4.5h4V6M6.5 6l.7 9.5h5.6l.7-9.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function deleteNoteById(id) {
  if (notes.length === 1) {
    notes[0] = createNote({ isPrivate: profile.defaultPrivate });
    activeId = notes[0].id;
  } else {
    notes = notes.filter((n) => n.id !== id);
    if (activeId === id || !notes.some((n) => n.id === activeId)) {
      activeId = notes[0].id;
    }
  }
  saveNotes();
  renderAll();
  renderProfile();
}

function renderSidebar() {
  noteListEl.innerHTML = "";
  const q = chatSearchQuery.trim().toLowerCase();
  const visibleNotes = q
    ? notes.filter((n) => {
        const inTitle = (n.title || "").toLowerCase().includes(q);
        const inMsgs = (n.messages || []).some((m) => (m.text || "").toLowerCase().includes(q));
        return inTitle || inMsgs;
      })
    : notes;

  if (visibleNotes.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "note-empty-search";
    emptyLi.textContent = "No matching chats found.";
    noteListEl.appendChild(emptyLi);
    return;
  }

  for (const note of visibleNotes) {
    const li = document.createElement("li");
    li.className = `note-row${note.id === activeId ? " active" : ""}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `note-item${note.id === activeId ? " active" : ""}`;
    btn.style.setProperty("--stagger-i", String(Math.min(noteListEl.children.length, 10)));
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(note.id === activeId));
    btn.addEventListener("click", () => {
      activeId = note.id;
      if (!homeView.hidden) showView("workspace");
      else setDrawerOpen(false);
      renderAll();
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

    const rowActions = document.createElement("div");
    rowActions.className = "note-row-actions";

    const rowRenameBtn = document.createElement("button");
    rowRenameBtn.type = "button";
    rowRenameBtn.className = "note-row-btn";
    rowRenameBtn.setAttribute("aria-label", "Rename chat");
    rowRenameBtn.title = "Rename";
    rowRenameBtn.innerHTML = EDIT_SVG;
    rowRenameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      activeId = note.id;
      if (!homeView.hidden) showView("workspace");
      else setDrawerOpen(false);
      renderAll();
      titleInput.focus();
      titleInput.select();
    });

    const rowDeleteBtn = document.createElement("button");
    rowDeleteBtn.type = "button";
    rowDeleteBtn.className = "note-row-btn danger";
    rowDeleteBtn.setAttribute("aria-label", "Delete chat");
    rowDeleteBtn.title = "Delete";
    rowDeleteBtn.innerHTML = TRASH_SVG;
    rowDeleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNoteById(note.id);
    });

    rowActions.append(rowRenameBtn, rowDeleteBtn);
    li.append(btn, rowActions);
    noteListEl.appendChild(li);
  }
}

const COPY_SVG =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M5 13H4a1.5 1.5 0 01-1.5-1.5v-7A1.5 1.5 0 014 3h7a1.5 1.5 0 011.5 1.5V6" stroke-linecap="round"/></svg>';
const CHECK_SVG =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EDIT_SVG =
  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M13.5 3.5l3 3L6.5 16.5H3.5v-3L13.5 3.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function makeCopyBtn(getText) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "msg-action-icon";
  btn.setAttribute("aria-label", "Copy message");
  btn.title = "Copy";
  btn.innerHTML = COPY_SVG;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getText());
      btn.innerHTML = CHECK_SVG;
      btn.classList.add("copied");
      setTimeout(() => {
        btn.innerHTML = COPY_SVG;
        btn.classList.remove("copied");
      }, 1500);
    } catch {
      // Clipboard unavailable.
    }
  });
  return btn;
}

function renderThread() {
  const chat = getActiveNote();
  chatThreadEl.innerHTML = "";
  if (!chat || chat.messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    const kicker = document.createElement("span");
    kicker.className = "chat-empty-kicker";
    kicker.textContent = "START WITH A STUDY TASK";
    const h3 = document.createElement("h3");
    h3.textContent = "What are you studying?";
    const p = document.createElement("p");
    p.textContent =
      "Write or paste your notes below, then choose a task. Routing depends on the task, your settings, and device availability.";
    const actions = document.createElement("div");
    actions.className = "chat-empty-actions";
    const quickTasks = [
      ["summarize", "Summarize", "Find the main ideas in your notes."],
      ["quiz", "Quiz me", "Turn notes into questions to practise."],
      ["todos", "Make a to-do list", "Pull out study tasks and next steps."],
    ];
    for (const [index, [task, title, description]] of quickTasks.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-empty-action";
      button.setAttribute("aria-pressed", String(selectedTask === task));
      const number = document.createElement("span");
      number.className = "chat-empty-action-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const label = document.createElement("strong");
      label.textContent = title;
      const detail = document.createElement("span");
      detail.textContent = description;
      button.append(number, label, detail);
      button.addEventListener("click", () => {
        selectTask(task);
        contentInput.focus();
      });
      button.dataset.task = task;
      actions.appendChild(button);
    }
    empty.append(kicker, h3, p, actions);
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

      const lineCount = msg.text.split(/\r?\n/).length;
      const isLong = msg.text.length > 260 || lineCount > 5;

      const textEl = document.createElement("div");
      textEl.className = `chat-msg-text${isLong ? " is-collapsed" : ""}`;
      textEl.textContent = msg.text;

      bubble.append(meta);
      if (msg.attachment?.dataUrl) {
        const imgEl = document.createElement("img");
        imgEl.className = "msg-attachment-img";
        imgEl.src = msg.attachment.dataUrl;
        imgEl.alt = msg.attachment.name || "Attached study image";
        bubble.appendChild(imgEl);
      }
      bubble.append(textEl);

      if (isLong) {
        const expandBtn = document.createElement("button");
        expandBtn.type = "button";
        expandBtn.className = "msg-expand-btn";
        expandBtn.setAttribute("aria-expanded", "false");
        expandBtn.innerHTML =
          '<span>Show full</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 7.5l5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        expandBtn.addEventListener("click", () => {
          const collapsed = textEl.classList.toggle("is-collapsed");
          expandBtn.setAttribute("aria-expanded", String(!collapsed));
          expandBtn.querySelector("span").textContent = collapsed ? "Show full" : "Show less";
        });
        bubble.appendChild(expandBtn);
      }

      const userActions = document.createElement("div");
      userActions.className = "msg-hover-actions";
      userActions.appendChild(makeCopyBtn(() => msg.text));

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "msg-action-icon";
      editBtn.setAttribute("aria-label", "Edit and reuse prompt");
      editBtn.title = "Edit in composer";
      editBtn.innerHTML = EDIT_SVG;
      editBtn.addEventListener("click", () => {
        contentInput.value = msg.text;
        chat.draft = msg.text;
        charCountEl.textContent = `${msg.text.trim().length} chars`;
        autoResizeEditor();
        saveNotes();
        contentInput.focus();
      });
      userActions.appendChild(editBtn);
      bubble.appendChild(userActions);

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
          qCard.style.setProperty("--stagger-i", String(qIdx));

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
              if (oIdx !== item.answerIndex && !item.review) {
                scheduleMissedQuizItem(item);
              }
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
            const reviewNote =
              !gotIt && item.review?.reviews === 0
                ? ` Added to Study Loop · due ${formatReviewDate(item.review.dueAt)}.`
                : "";
            fb.textContent = `${gotIt ? "✓ Correct!" : `✗ Incorrect — Answer: ${String.fromCharCode(65 + item.answerIndex)}.`} ${item.explanation || ""}${reviewNote}`;
            qCard.appendChild(fb);
          }

          quizList.appendChild(qCard);
        });

        const scoreBar = document.createElement("div");
        scoreBar.className = "quiz-score-bar mono";
        scoreBar.textContent = `Score: ${correctCount} / ${msg.quizItems.length} (${answeredCount} answered)`;
        quizList.appendChild(scoreBar);

        if (answeredCount === msg.quizItems.length && msg.quizItems.length > 0) {
          const peakBanner = document.createElement("div");
          peakBanner.className = "peak-end-banner";
          const perfect = correctCount === msg.quizItems.length;
          peakBanner.innerHTML = `<span>${perfect ? "Perfect score!" : "Quiz complete!"} ${correctCount} / ${msg.quizItems.length}</span><span class="mono">${perfect ? "100% mastered" : "Missed cards saved to Study Loop"}</span>`;
          quizList.appendChild(peakBanner);
        }

        card.append(header, reason, quizList);
      } else {
        const body = document.createElement("div");
        const isThinking = msg.badgeText === "Running...";
        body.className = `result-body${isThinking ? " is-thinking" : ""}`;
        if (isThinking) {
          body.innerHTML = `<span class="thinking-row"><span class="typing-wave" aria-hidden="true"><i></i><i></i><i></i></span><span>${escapeHtml(msg.text || "Thinking…")}</span></span>`;
        } else {
          body.innerHTML = renderMarkdownSafe(msg.text || "");
        }
        card.append(header, reason, body);
        if (msg.badgeClass === "badge-cloud" && msg.sanitizedPrompt) {
          const proofWrap = document.createElement("div");
          proofWrap.className = "privacy-proof-wrap";

          const proofBtn = document.createElement("button");
          proofBtn.type = "button";
          proofBtn.className = "privacy-proof-pill";
          proofBtn.setAttribute("aria-expanded", "false");
          proofBtn.textContent = msg.privacySummary
            ? `Privacy Proof · ${msg.privacySummary}`
            : "Privacy Proof · View cloud payload";

          const proofBox = document.createElement("pre");
          proofBox.className = "privacy-proof-box mono";
          proofBox.hidden = true;
          proofBox.textContent = msg.sanitizedPrompt;

          proofBtn.addEventListener("click", () => {
            const nextHidden = !proofBox.hidden;
            proofBox.hidden = nextHidden;
            proofBtn.setAttribute("aria-expanded", String(!nextHidden));
          });

          proofWrap.append(proofBtn, proofBox);
          card.appendChild(proofWrap);
        }

        if (msg.badgeText === "Error" && /gemini nano|on-device/i.test(msg.text || "")) {
          const errActions = document.createElement("div");
          errActions.className = "error-action-row";

          const guideBtn = document.createElement("button");
          guideBtn.type = "button";
          guideBtn.className = "pill-btn btn-ghost";
          guideBtn.textContent = "How to Enable";
          guideBtn.addEventListener("click", () => openNanoDownloadModal());

          const autoSwitchBtn = document.createElement("button");
          autoSwitchBtn.type = "button";
          autoSwitchBtn.className = "pill-btn btn-primary";
          autoSwitchBtn.textContent = "Switch to Auto (Cloud)";
          autoSwitchBtn.addEventListener("click", () => {
            const activeChat = getActiveNote();
            if (activeChat?.isPrivate) {
              activeChat.isPrivate = false;
              if (privateToggle) privateToggle.checked = false;
              saveNotes();
              renderAll();
            }
            selectModel("auto");
            contentInput.focus();
          });

          errActions.append(guideBtn, autoSwitchBtn);
          card.appendChild(errActions);
        }
      }
      if (msg.badgeText !== "Running..." && msg.text) {
        const aiActions = document.createElement("div");
        aiActions.className = "msg-hover-actions";
        aiActions.appendChild(makeCopyBtn(() => msg.text));
        card.appendChild(aiActions);
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
  updateStudyLoopButton();
}

function formatReviewDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function updateStudyLoopButton() {
  if (!studyLoopBtn || !studyLoopCountEl) return;
  const summary = getStudyLoopSummary(notes);
  studyLoopCountEl.textContent = summary.due
    ? `${summary.due} due`
    : summary.upcoming
      ? `${summary.upcoming} upcoming`
      : "Start";
  studyLoopBtn.setAttribute(
    "aria-label",
    summary.due
      ? `Study Loop, ${summary.due} reviews due`
      : summary.upcoming
        ? `Study Loop, ${summary.upcoming} upcoming reviews`
        : "Study Loop, no reviews scheduled"
  );
}

function updateStudyLoopSummary() {
  const summary = getStudyLoopSummary(notes);
  if (summary.due) {
    studyLoopSummaryEl.textContent =
      `${summary.due} due now · ${summary.upcoming} coming up · ` +
      `${summary.completedReviews} reviews finished`;
  } else if (summary.upcoming) {
    studyLoopSummaryEl.textContent =
      `All caught up. ${summary.upcoming} coming up; next review ${formatReviewDate(summary.nextDueAt)}.`;
  } else {
    studyLoopSummaryEl.textContent = "Miss a quiz answer to add it here for review tomorrow.";
  }
}

function renderStudyReviewCard() {
  const entry = studyReviewQueue[studyReviewIndex];
  if (!entry) {
    studyReviewCardEl.hidden = true;
    studyLoopEmptyEl.hidden = false;
    const summary = getStudyLoopSummary(notes);
    studyLoopCreateQuizBtn.hidden = summary.due > 0 || summary.upcoming > 0;
    studyLoopEmptyEl.textContent = summary.upcoming
      ? `Review complete. Your next card is due ${formatReviewDate(summary.nextDueAt)}.`
      : summary.completedReviews
        ? "Review complete. You are all caught up."
        : "No review cards yet. Create a Quiz Me set and miss an answer to start.";
    studyReviewProgressEl.textContent = "";
    updateStudyLoopSummary();
    return;
  }

  studyLoopCreateQuizBtn.hidden = true;
  studyLoopEmptyEl.hidden = true;
  studyReviewCardEl.hidden = false;
  studyReviewProgressEl.textContent =
    `Card ${studyReviewIndex + 1} of ${studyReviewQueue.length}`;
  studyReviewNoteEl.textContent = entry.noteTitle;
  studyReviewQuestionEl.textContent = entry.item.q;
  studyReviewOptionsEl.replaceChildren();
  studyReviewFeedbackEl.hidden = true;
  studyReviewFeedbackEl.className = "quiz-feedback";
  studyReviewNextBtn.hidden = true;

  entry.item.options.forEach((option, optionIndex) => {
    const optionBtn = document.createElement("button");
    optionBtn.type = "button";
    optionBtn.className = "quiz-opt-btn";
    optionBtn.textContent = `${String.fromCharCode(65 + optionIndex)}. ${String(option)}`;
    optionBtn.addEventListener("click", () => answerStudyReview(entry, optionIndex));
    studyReviewOptionsEl.appendChild(optionBtn);
  });
}

function answerStudyReview(entry, selectedIndex) {
  if (studyReviewNextBtn.hidden === false) return;

  const remembered = selectedIndex === entry.item.answerIndex;
  const review = recordReviewOutcome(entry.item, remembered);
  Array.from(studyReviewOptionsEl.children).forEach((button, optionIndex) => {
    button.disabled = true;
    if (optionIndex === entry.item.answerIndex) button.classList.add("is-correct");
    else if (optionIndex === selectedIndex) button.classList.add("is-wrong");
  });

  studyReviewFeedbackEl.className = `quiz-feedback ${remembered ? "correct" : "wrong"}`;
  studyReviewFeedbackEl.textContent = remembered
    ? `Correct. Next review: ${formatReviewDate(review.dueAt)}. ${entry.item.explanation || ""}`
    : `Not quite. This card is scheduled again for ${formatReviewDate(review.dueAt)}. ${entry.item.explanation || ""}`;
  studyReviewFeedbackEl.hidden = false;
  studyReviewNextBtn.textContent =
    studyReviewIndex === studyReviewQueue.length - 1 ? "Finish review" : "Next card";
  studyReviewNextBtn.hidden = false;

  saveNotes();
  renderStudyLoopSummary();
  renderThread();
}

function renderStudyLoopSummary() {
  updateStudyLoopSummary();
  updateStudyLoopButton();
}

function refreshStudyLoopToolbar() {
  const weakBtn = document.getElementById("study-loop-weak-btn");
  const exportAnkiLoopBtn = document.getElementById("study-loop-export-anki-btn");
  const weakItems = getWeakSpotItems(notes);
  const allItems = getStudyLoopItems(notes);
  if (weakBtn) {
    weakBtn.hidden = weakItems.length === 0;
    weakBtn.textContent = `Weak-Spot Drill (${weakItems.length}) · Offline`;
  }
  if (exportAnkiLoopBtn) {
    exportAnkiLoopBtn.hidden = allItems.length === 0;
  }
}

function openStudyLoop({ weakSpotOnly = false } = {}) {
  setDrawerOpen(false);
  studyReviewQueue = weakSpotOnly ? getWeakSpotItems(notes) : getDueStudyLoopItems(notes);
  studyReviewIndex = 0;
  updateStudyLoopSummary();
  refreshStudyLoopToolbar();
  if (studyReviewQueue.length) {
    renderStudyReviewCard();
  } else {
    studyReviewCardEl.hidden = true;
    studyLoopEmptyEl.hidden = false;
    const summary = getStudyLoopSummary(notes);
    const weakItems = getWeakSpotItems(notes);
    studyLoopCreateQuizBtn.hidden = summary.upcoming > 0;
    studyLoopEmptyEl.textContent = summary.upcoming
      ? `You're all caught up. Your next review is ${formatReviewDate(summary.nextDueAt)}.${weakItems.length ? " Use Weak-Spot Drill above to practice missed cards offline anytime." : ""}`
      : "No review cards yet. Create a Quiz Me set, then miss an answer to start.";
    studyReviewProgressEl.textContent = "";
  }
  if (!studyLoopModal.open) studyLoopModal.showModal();
}

function startQuizInWorkspace() {
  if (studyLoopModal?.open) studyLoopModal.close();
  showView("workspace");
  selectTask("quiz");
  if (!demoModal?.open) contentInput.focus();
}

function resetStudyLoopDemo() {
  studyLoopDemoOptions.forEach((option) => {
    option.disabled = false;
    option.classList.remove("is-correct", "is-wrong");
  });
  studyLoopDemoFeedback.hidden = true;
  studyLoopDemoFeedback.textContent = "";
  studyLoopDemoFeedback.className = "quiz-feedback study-loop-demo-feedback";
  studyLoopDemoResetBtn.hidden = true;
}

studyLoopDemoOptions.forEach((option) => {
  option.addEventListener("click", () => {
    const remembered = option.dataset.correct === "true";
    studyLoopDemoOptions.forEach((choice) => {
      choice.disabled = true;
      if (choice.dataset.correct === "true") choice.classList.add("is-correct");
      else if (choice === option) choice.classList.add("is-wrong");
    });
    studyLoopDemoFeedback.className =
      `quiz-feedback study-loop-demo-feedback ${remembered ? "correct" : "wrong"}`;
    studyLoopDemoFeedback.textContent = remembered
      ? "That's right. Next review: 3 days; later it spaces out to 7, then 14 days."
      : "Not quite. This question would return tomorrow. The answer is the mitochondrion.";
    studyLoopDemoFeedback.hidden = false;
    studyLoopDemoResetBtn.hidden = false;
  });
});

studyLoopDemoResetBtn?.addEventListener("click", resetStudyLoopDemo);
studyLoopDemoStartBtn?.addEventListener("click", startQuizInWorkspace);
studyLoopBtn?.addEventListener("click", openStudyLoop);
closeStudyLoopBtn?.addEventListener("click", () => studyLoopModal.close());
studyLoopCreateQuizBtn?.addEventListener("click", startQuizInWorkspace);
studyReviewNextBtn?.addEventListener("click", () => {
  studyReviewIndex += 1;
  renderStudyReviewCard();
});
studyLoopModal?.addEventListener("click", (event) => {
  if (event.target === studyLoopModal) studyLoopModal.close();
});

function updateOfflineBanner() {
  offlineBanner.hidden = !isAppOffline();
}

const offlineReadinessModal = document.getElementById("offline-readiness-modal");
const offlineReadinessOpen = document.getElementById("offline-readiness-open");
const offlineReadinessClose = document.getElementById("offline-readiness-close");

offlineReadinessOpen?.addEventListener("click", async () => {
  const modal = offlineReadinessModal;
  if (!modal) return;
  modal.showModal();
  const status = await getOnDeviceStatus();
  document.getElementById("offline-nano-status").textContent =
    status === "available" ? "Ready" : status === "downloadable" ? "Downloadable" : status;
  const storage = await getStorageInfo();
  await requestPersistentStorage();
  const refreshed = await getStorageInfo();
  const fmt = (bytes) => bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "0 MB";
  document.getElementById("offline-storage-summary").textContent =
    `${fmt(refreshed.usage)} used · ${fmt(refreshed.quota)} quota · ${refreshed.persisted ? "persistent" : "not persistent"}`;
  document.getElementById("offline-readiness-summary").textContent =
    isAppOffline()
      ? "You are offline. Only locally ready components and cached app features are available."
      : "Review what can continue offline after setup.";
});
offlineReadinessClose?.addEventListener("click", () => offlineReadinessModal?.close());

const HYBRIDNOTES_SELF_CONTEXT =
  "You are the assistant inside HybridNotes, a private-by-default hybrid AI study notes PWA. HybridNotes routes supported tasks and Private/Offline notes to on-device Chrome Gemini Nano when available, and routes longer or deep tasks to Cloud Gemini 3.5 Flash-Lite after masking common identifiers locally. All chats, stats, and profiles are stored locally in the user's browser (localStorage).";

function inferAutoIntent(text) {
  const t = text.trim().toLowerCase();
  if (/\b(quiz me|test me|mcq|flashcards?|practice questions?)\b/.test(t)) return "quiz";
  if (/\b(fix grammar|proofread|spell\s*check)\b/.test(t)) return "grammar";
  if (/\b(extract to-?dos?|action items?|checklist)\b/.test(t)) return "todos";
  if (/\b(suggest title|give.*title)\b/.test(t)) return "title";
  if (/^(summarize|tl;?dr|summary)\b/.test(t)) return "summarize";
  return "chat";
}

function getRecentChatContext(chat, maxChars = 1100) {
  if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) return "";
  const recent = chat.messages
    .filter((m) => m.text && m.badgeText !== "Running..." && m.badgeText !== "Error")
    .slice(-4);
  if (!recent.length) return "";
  let out = "";
  for (const m of recent) {
    const label = m.role === "user" ? "User" : "Assistant";
    const snippet = m.text.length > 420 ? `${m.text.slice(0, 420)}…` : m.text;
    const line = `${label}: ${snippet}\n`;
    if (out.length + line.length > maxChars) break;
    out += line;
  }
  return out.trim();
}

function buildPrompt(task, text, chat = null) {
  const mentionsApp = /hybrid\s*notes|this app|this tool|how do you work/i.test(text);
  const appPrefix = mentionsApp ? `${HYBRIDNOTES_SELF_CONTEXT}\n\n` : "";
  const history = getRecentChatContext(chat);
  const historyBlock = history ? `Recent conversation:\n${history}\n\n` : "";

  const effectiveTask = task === "auto" ? inferAutoIntent(text) : task;

  if (effectiveTask === "chat") {
    return `${appPrefix}${historyBlock}You are a helpful, concise study and coding assistant. Answer the user's message, question, doubt, or code explanation directly and clearly (use short bullet points or code blocks when helpful):\n\n${text}`;
  }

  switch (effectiveTask) {
    case "summarize":
      return `${appPrefix}${historyBlock}Summarize these study notes clearly in 3-4 bullet points:\n\n${text}`;
    case "quiz": {
      const sourceMaterial = text.length < 80 && history ? `${history}\n\nRequest: ${text}` : text;
      return `Create 3-4 multiple-choice quiz questions based ONLY on the study material below. Return exactly this JSON shape with no markdown or extra text: {"questions":[{"question":"Question text?","options":["Option A","Option B","Option C","Option D"],"answerIndex":0,"explanation":"Short 1-sentence explanation."}]}\n\nMaterial:\n${sourceMaterial}`;
    }
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
  const structured = parseQuizJson(rawText);
  if (structured) {
    return structured.map((item) => ({
      q: item.question,
      options: item.options,
      answerIndex: item.answerIndex,
      explanation: item.explanation,
    }));
  }
  return parseLegacyQuizText(rawText);
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

  const rawText = contentInput.value.trim();
  const attachment = pendingAttachment ? { ...pendingAttachment } : null;
  const text = rawText || (attachment ? "Summarize this study image and highlight key concepts." : "");
  const task = selectedTask;
  const taskLabel =
    task === "translate"
      ? `Translate (${translateLangEl.value})`
      : TASK_LABELS[task] || "Prompt";

  if (!text && !attachment) {
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
      reason: "Model set to Gemini Nano (prompt processed on-device only).",
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
    attachment: attachment ? { name: attachment.name, dataUrl: attachment.dataUrl } : null,
    createdAt: Date.now(),
  };
  clearPendingAttachment();

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

      let streamTarget = "";
      let streamShown = 0;
      let streamRaf = null;

      const paintStream = () => {
        const bodies = chatThreadEl.querySelectorAll(".result-body");
        const lastBody = bodies[bodies.length - 1];
        if (!lastBody) return;
        lastBody.classList.remove("is-thinking");
        const slice = streamTarget.slice(0, streamShown);
        lastBody.innerHTML = `${renderMarkdownSafe(slice)}<span class="stream-cursor" aria-hidden="true"></span>`;
        scrollFeedToBottom();
      };

      const stepStream = () => {
        if (streamShown < streamTarget.length) {
          const remaining = streamTarget.length - streamShown;
          const step = Math.max(1, Math.min(6, Math.ceil(remaining / 10)));
          streamShown = Math.min(streamTarget.length, streamShown + step);
          paintStream();
          streamRaf = requestAnimationFrame(stepStream);
        } else {
          streamRaf = null;
        }
      };

      const updateLiveStatus = (statusText) => {
        aiMsg.text = statusText;
        const bodies = chatThreadEl.querySelectorAll(".result-body");
        const lastBody = bodies[bodies.length - 1];
        if (lastBody && !streamTarget) {
          lastBody.innerHTML = `<span class="thinking-row"><span class="typing-wave" aria-hidden="true"><i></i><i></i><i></i></span><span>${escapeHtml(statusText)}</span></span>`;
          scrollFeedToBottom();
        }
      };

      const onStreamToken = (partial) => {
        streamTarget = partial;
        aiMsg.text = partial;
        if (!streamRaf) {
          streamRaf = requestAnimationFrame(stepStream);
        }
      };

      const isQuiz = task === "quiz" || (task === "auto" && inferAutoIntent(text) === "quiz");

      try {
        const runQuizRequest = () => runAI({
          prompt: buildPrompt(task, inputText, chat),
          image: attachment,
          mode: route.mode,
          signal,
          onStatus: updateLiveStatus,
          onStream: isQuiz ? undefined : onStreamToken,
          onDownloadProgress: (pct) => {
            updateLiveStatus(`Downloading Gemini Nano locally: ${pct}%`);
          },
          structuredOutput: isQuiz ? QUIZ_RESPONSE_SCHEMA : null,
        });
        res = await runQuizRequest();
        if (isQuiz && !parseQuizItems(res.text)) {
          res = await runQuizRequest();
        }
      } finally {
        if (streamRaf) {
          cancelAnimationFrame(streamRaf);
          streamRaf = null;
        }
      }
    }

    const estimatedTextBytes = new Blob([text, res.text]).size;
    recordStat(res.source, res.ms, estimatedTextBytes, res.maskedCount || 0);

    const isOnDevice = res.source === "on-device";
    privacySummary = isOnDevice ? "" : (res.privacySummary || privacySummary);
    const reasonText =
      route.mode === "PREFER_ON_DEVICE" && !isOnDevice
        ? `${route.reason} (Fell back to cloud.)`
        : `${route.reason}${extraReason}`;

    aiMsg.badgeText = isOnDevice ? "Gemini Nano" : "Gemini 3.5 Flash-Lite";
    aiMsg.badgeClass = isOnDevice ? "badge-on-device" : "badge-cloud";
    aiMsg.privacySummary = !isOnDevice ? privacySummary : "";
    aiMsg.sanitizedPrompt = !isOnDevice ? (res.sanitizedPrompt || "") : "";
    aiMsg.latencyText = formatSec(res.ms);
    aiMsg.reason = reasonText;
    aiMsg.text = res.text;
    const effectiveTask = task === "auto" ? inferAutoIntent(text) : task;
    if (effectiveTask === "quiz") {
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
brandHomeBtn?.addEventListener("click", () => showView("home"));
sidebarHomeBtn?.addEventListener("click", () => showView("home"));
navFeaturesBtn?.addEventListener("click", () => showView("home", "features"));
navPrivacyBtn?.addEventListener("click", () => showView("privacy"));
navOssBtn?.addEventListener("click", () => showView("home", "oss"));
navWorkspaceBtn.addEventListener("click", () => showView("workspace"));
launchWorkspaceBtn.addEventListener("click", () => showView("workspace"));
footerLaunchBtn?.addEventListener("click", () => showView("workspace"));
footerPrivacyBtn?.addEventListener("click", () => showView("privacy"));
document.getElementById("priv-open-ws-btn")?.addEventListener("click", () => showView("workspace"));
document.getElementById("priv-footer-home-btn")?.addEventListener("click", () => showView("home"));
document.getElementById("priv-profile-btn")?.addEventListener("click", () => {
  openSettings();
});

// === Privacy Page Live PII Redactor ===
const privTestInput = document.getElementById("priv-test-input");
const privTestOutput = document.getElementById("priv-test-output");
const privMaskCount = document.getElementById("priv-mask-count");
const privSimPrivate = document.getElementById("priv-sim-private");
const privSimDeep = document.getElementById("priv-sim-deep");
const privRouteBadge = document.getElementById("priv-route-badge");

function renderPrivacyTester() {
  if (!privTestInput || !privTestOutput) return;
  if (!privTestInput.value) {
    privTestInput.value = "Bio lab partner: sam.irfan@college.edu, phone +91 98765 43210, ID 20264819. Review ATP synthesis.";
  }
  const { sanitizedText, maskedCount } = sanitizeForCloud(privTestInput.value);
  privTestOutput.innerHTML = escapeHtml(sanitizedText).replace(
    /\[(REDACTED_EMAIL|REDACTED_PHONE|REDACTED_ID)\]/g,
    '<span class="hn-redact-token">[$1]</span>'
  );
  if (privMaskCount) {
    privMaskCount.textContent = maskedCount
      ? `${maskedCount} identifier${maskedCount === 1 ? "" : "s"} masked`
      : "No identifiers matched by the current rules";
  }

  if (privRouteBadge) {
    const r = decideRoute({
      task: privSimDeep?.checked ? "deep-analyze" : "auto",
      text: privTestInput.value,
      isPrivate: Boolean(privSimPrivate?.checked),
      isOffline: isAppOffline(),
      maxOnDeviceChars,
    });
    privRouteBadge.textContent = `Route: ${r.mode || "BLOCKED"}`;
    privRouteBadge.className = `badge mono ${r.mode?.includes("ON_DEVICE") ? "badge-on-device" : "badge-cloud"}`;
  }
}

privTestInput?.addEventListener("input", renderPrivacyTester);
privSimPrivate?.addEventListener("change", renderPrivacyTester);
privSimDeep?.addEventListener("change", renderPrivacyTester);
document.querySelectorAll(".priv-preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!privTestInput) return;
    if (btn.dataset.preset === "email") {
      privTestInput.value = "Email Dr. Rao at rao.lab@university.edu with student ID 20264819 before Friday.";
    } else if (btn.dataset.preset === "phone") {
      privTestInput.value = "Call lab partner on +91 98765 43210 or 555-019-2834 for organic chem notes.";
    } else {
      privTestInput.value = "Mitochondria produce ATP via oxidative phosphorylation across the inner membrane.";
    }
    renderPrivacyTester();
  });
});

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
settingsMenuBtn?.addEventListener("click", () => {
  setDrawerOpen(!sidebar.classList.contains("drawer-open"));
});
closeDrawerBtn.addEventListener("click", () => {
  if (window.matchMedia("(max-width: 820px)").matches) {
    setDrawerOpen(false);
    return;
  }
  const isExpanded = closeDrawerBtn.getAttribute("aria-expanded") === "true";
  workspaceView.classList.toggle("sidebar-collapsed", isExpanded);
  closeDrawerBtn.setAttribute("aria-expanded", String(!isExpanded));
  closeDrawerBtn.setAttribute(
    "aria-label",
    isExpanded ? "Expand sidebar" : "Collapse sidebar"
  );
});
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
  deleteNoteById(activeId);
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
    desc: "Type or paste class notes and tap Send. With Gemini Nano available, supported short tasks can run on-device.",
    pill: "Summarize · On-Device",
    inputLabel: "YOU TYPE",
    typed: "Photosynthesis turns sunlight, water, and CO2 into glucose and oxygen inside chloroplasts.",
    outBadge: "On-device",
    outBadgeClass: "badge-on-device",
    outStat: "240 ms · prompt stays local",
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
  if (settingsAvatarInitials) settingsAvatarInitials.textContent = initials;
  if (sidebarAvatarInitials) sidebarAvatarInitials.textContent = initials;
  if (sidebarProfileName) sidebarProfileName.textContent = profile.name || "Student";
  if (profileNameInput && profileNameInput.value !== profile.name) {
    profileNameInput.value = profile.name;
  }
  if (profileFocusInput && profileFocusInput.value !== profile.focus) {
    profileFocusInput.value = profile.focus;
  }
  if (profileDefaultPrivate) {
    profileDefaultPrivate.checked = Boolean(profile.defaultPrivate);
  }
  if (profileRoutingTelemetry) {
    profileRoutingTelemetry.checked = profile.routingTelemetry !== false;
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
    profileQuotaSummary.textContent = `${usedKb} KB / ~${quotaKb.toLocaleString()} KB estimated storage`;
  }
  if (profileChatsCount) {
    profileChatsCount.textContent = `${notes.length} chats · ${msgCount} messages`;
  }
  if (profileQuotaBar) {
    profileQuotaBar.style.width = `${pct}%`;
  }

}

function selectSettingsTab(activeTab) {
  const selectedTab = Array.from(settingsTabs).find((tab) => tab.dataset.settingsTab === activeTab);
  if (!selectedTab) return;

  settingsTabs.forEach((tab) => {
    const isActive = tab === selectedTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  settingsPanels.forEach((panel) => {
    panel.hidden = panel.id !== `settings-panel-${activeTab}`;
  });
}

function openSettings(tab = "profile") {
  selectSettingsTab(tab);
  showView("settings");
}

profileBtn?.addEventListener("click", () => openSettings());
sidebarProfileBtn?.addEventListener("click", () => {
  setDrawerOpen(false);
  openSettings();
});
settingsBackBtn?.addEventListener("click", () => showView("workspace"));
settingsTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    selectSettingsTab(tab.dataset.settingsTab);
  });
});
sidebarStatsBtn?.addEventListener("click", () => {
  setDrawerOpen(false);
  openSettings("usage");
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
profileRoutingTelemetry?.addEventListener("change", () => {
  profile.routingTelemetry = profileRoutingTelemetry.checked;
  saveProfile();
  if (!profile.routingTelemetry) {
    stats = { ...DEFAULT_STATS };
  }
  saveStats();
  renderStats();
  renderProfile();
});

chatSearchInput?.addEventListener("input", () => {
  chatSearchQuery = chatSearchInput.value || "";
  renderSidebar();
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
  a.download = `hybridnotes-notes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

profileImportBtn?.addEventListener("click", () => {
  profileImportInput?.click();
});

profileImportInput?.addEventListener("change", async () => {
  const file = profileImportInput.files?.[0];
  profileImportInput.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed?.chats) ? parsed.chats.map(migrateNote) : [];
    if (incoming.length === 0) {
      window.alert("No saved notes were found in that file.");
      return;
    }
    const existingIds = new Set(notes.map((n) => n.id));
    let added = 0;
    for (const chat of incoming) {
      if (!existingIds.has(chat.id)) {
        notes.push(chat);
        existingIds.add(chat.id);
        added += 1;
      }
    }
    if (added > 0) {
      notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      activeId = notes[0]?.id || activeId;
      saveNotes();
      renderAll();
      renderProfile();
    }
    window.alert(added > 0 ? `Loaded ${added} saved ${added === 1 ? "chat" : "chats"}!` : "All notes from that file are already here.");
  } catch {
    window.alert("Could not open that file. Please choose a file saved from HybridNotes.");
  }
});

profileTourBtn?.addEventListener("click", () => {
  showView("workspace");
  openDemoModal(0);
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
});

initCarousel();
initScrollReveals();
showView("home");
updateOfflineBanner();
updateSelectedChip();
renderAll();

// === Composer File & Image Drop / Paste ===
const editorWrapEl = document.getElementById("editor-wrap");
const attachmentPreviewEl = document.getElementById("attachment-preview");
const attachmentThumbEl = document.getElementById("attachment-thumb");
const attachmentNameEl = document.getElementById("attachment-name");
const attachmentRemoveBtn = document.getElementById("attachment-remove-btn");
const attachFileBtn = document.getElementById("attach-file-btn");
const attachFileInput = document.getElementById("attach-file-input");
const ocrModal = document.getElementById("ocr-preview-modal");
const ocrClose = document.getElementById("ocr-preview-close");
const ocrText = document.getElementById("ocr-preview-text");
const ocrConfirm = document.getElementById("ocr-preview-confirm");
const ocrProgress = document.getElementById("ocr-progress");

function clearPendingAttachment() {
  pendingAttachment = null;
  if (attachmentPreviewEl) attachmentPreviewEl.hidden = true;
  if (attachmentThumbEl) {
    attachmentThumbEl.hidden = true;
    attachmentThumbEl.removeAttribute("src");
  }
  if (attachmentNameEl) attachmentNameEl.textContent = "";
  if (attachFileInput) attachFileInput.value = "";
}

async function handleIncomingFile(file) {
  if (!file) return;
  const isText =
    file.type.startsWith("text/") || /\.(txt|md|markdown|csv)$/i.test(file.name || "");
  if (isText) {
    const fileText = (await file.text()).trim();
    if (!fileText) return;
    const prefix = contentInput.value.trim() ? `${contentInput.value.trim()}\n\n` : "";
    contentInput.value = `${prefix}${fileText}`;
    const chat = getActiveNote();
    if (chat) {
      chat.draft = contentInput.value;
      saveNotes();
    }
    charCountEl.textContent = `${contentInput.value.trim().length} chars`;
    autoResizeEditor();
    contentInput.focus();
    return;
  }

  if (file.type.startsWith("image/")) {
    if (ocrModal) ocrModal.showModal();
    if (ocrText) {
      ocrText.value = "";
      ocrText.disabled = true;
    }
    if (ocrConfirm) ocrConfirm.disabled = true;
    if (ocrProgress) {
      ocrProgress.hidden = false;
      ocrProgress.value = 0;
    }
    try {
      const result = await extractText(file, {
        lang: "eng",
        onProgress: (progress) => {
          if (ocrProgress) ocrProgress.value = progress;
        },
      });
      if (ocrText) {
        ocrText.value = result.text || "";
        ocrText.disabled = false;
      }
      if (ocrConfirm) ocrConfirm.disabled = !(result.text || "").trim();
    } catch (error) {
      if (ocrText) {
        ocrText.value = "";
        ocrText.disabled = false;
      }
      window.alert(error?.message || "Could not read text from this image.");
    } finally {
      if (ocrProgress) ocrProgress.hidden = true;
    }
  }
}

attachFileBtn?.addEventListener("click", () => attachFileInput?.click());
attachFileInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleIncomingFile(file);
});
attachmentRemoveBtn?.addEventListener("click", clearPendingAttachment);
ocrClose?.addEventListener("click", () => ocrModal?.close());
ocrModal?.addEventListener("click", (event) => {
  if (event.target === ocrModal) ocrModal.close();
});
ocrConfirm?.addEventListener("click", () => {
  const extracted = ocrText?.value.trim();
  if (!extracted) return;
  const prefix = contentInput.value.trim() ? `${contentInput.value.trim()}\n\n` : "";
  contentInput.value = `${prefix}${extracted}`;
  const chat = getActiveNote();
  if (chat) {
    chat.draft = contentInput.value;
    saveNotes();
  }
  charCountEl.textContent = `${contentInput.value.trim().length} chars`;
  autoResizeEditor();
  ocrModal?.close();
  contentInput.focus();
});

editorWrapEl?.addEventListener("dragover", (e) => {
  e.preventDefault();
  editorWrapEl.classList.add("is-dragover");
});
editorWrapEl?.addEventListener("dragleave", () => {
  editorWrapEl.classList.remove("is-dragover");
});
editorWrapEl?.addEventListener("drop", (e) => {
  e.preventDefault();
  editorWrapEl.classList.remove("is-dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) handleIncomingFile(file);
});

contentInput?.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        handleIncomingFile(file);
        break;
      }
    }
  }
});

// === Export Markdown (.md) & Anki (.csv) ===
function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildReadableExport(format) {
  const chat = getActiveNote();
  const title = chat?.title || "Untitled Study Note";
  const sections = [format === "md" ? `# ${title}` : title];
  for (const msg of chat?.messages || []) {
    if (msg.role === "user") {
      sections.push(format === "md" ? `## Prompt (${msg.taskLabel || "Note"})\n\n${msg.text || ""}` : `\nPROMPT (${msg.taskLabel || "Note"})\n${msg.text || ""}`);
    } else if (msg.quizItems?.length) {
      const heading = format === "md" ? "## Quiz" : "\nQUIZ";
      sections.push(heading);
      msg.quizItems.forEach((item, idx) => {
        const options = (item.options || []).map((option, oIdx) =>
          format === "md"
            ? `- ${String.fromCharCode(65 + oIdx)}. ${option}${oIdx === item.answerIndex ? " *(Correct)*" : ""}`
            : `${String.fromCharCode(65 + oIdx)}. ${option}${oIdx === item.answerIndex ? " (Correct)" : ""}`
        ).join("\n");
        sections.push(format === "md"
          ? `### ${idx + 1}. ${item.q}\n\n${options}\n\n**Explanation:** ${item.explanation || ""}`
          : `${idx + 1}. ${item.q}\n${options}\nExplanation: ${item.explanation || ""}`);
      });
    } else if (msg.text) {
      sections.push(format === "md"
        ? `## Response (${msg.badgeText || "AI"})\n\n${msg.text}`
        : `\nRESPONSE (${msg.badgeText || "AI"})\n${msg.text}`);
    }
  }
  const due = getDueStudyLoopItems(notes);
  if (due.length) {
    sections.push(format === "md" ? "## Due Review Cards" : "\nDUE REVIEW CARDS");
    due.forEach((entry, idx) => {
      const item = entry.item;
      sections.push(format === "md"
        ? `### ${idx + 1}. ${item.q}\n\n**Answer:** ${item.options?.[item.answerIndex] || ""}\n\n**Explanation:** ${item.explanation || ""}`
        : `${idx + 1}. ${item.q}\nAnswer: ${item.options?.[item.answerIndex] || ""}\nExplanation: ${item.explanation || ""}`);
    });
  }
  return sections.join(format === "md" ? "\n\n" : "\n\n");
}

function safeSlug(title) {
  return (title || "hybridnotes-study")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "hybridnotes-study";
}

function csvEscape(val) {
  const s = String(val ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

document.getElementById("export-md-btn")?.addEventListener("click", () => {
  const chat = getActiveNote();
  if (!chat) return;
  const lines = [`# ${chat.title || "Untitled Study Note"}`, ""];
  for (const msg of chat.messages || []) {
    if (msg.role === "user") {
      lines.push(`## Prompt (${msg.taskLabel || "Note"})`, "", msg.text || "", "");
    } else if (msg.quizItems?.length) {
      lines.push(`## Quiz (${msg.badgeText || "AI"})`, "");
      msg.quizItems.forEach((item, idx) => {
        lines.push(`${idx + 1}. **${item.q}**`);
        (item.options || []).forEach((opt, oIdx) => {
          const mark = oIdx === item.answerIndex ? " *(Answer)*" : "";
          lines.push(`   - ${String.fromCharCode(65 + oIdx)}. ${opt}${mark}`);
        });
        if (item.explanation) lines.push(`   - _Why:_ ${item.explanation}`);
        lines.push("");
      });
    } else if (msg.text) {
      lines.push(`## Response (${msg.badgeText || "AI"})`, "", msg.text, "");
    }
  }
  triggerDownload(`${safeSlug(chat.title)}.md`, lines.join("\n"), "text/markdown;charset=utf-8");
});

document.getElementById("profile-export-txt-btn")?.addEventListener("click", () => {
  const chat = getActiveNote();
  if (!chat) return;
  triggerDownload(`${safeSlug(chat.title)}.txt`, buildReadableExport("txt"), "text/plain;charset=utf-8");
});

document.getElementById("profile-export-md-btn")?.addEventListener("click", () => {
  const chat = getActiveNote();
  if (!chat) return;
  triggerDownload(`${safeSlug(chat.title)}.md`, buildReadableExport("md"), "text/markdown;charset=utf-8");
});

document.getElementById("profile-export-pdf-btn")?.addEventListener("click", () => {
  const chat = getActiveNote();
  if (!chat) return;
  const printArea = document.getElementById("hn-print-area");
  if (!printArea) return;
  printArea.innerHTML = escapeHtml(buildReadableExport("txt"))
    .replace(/^(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
  printArea.hidden = false;
  window.print();
  printArea.hidden = true;
});

function exportAnkiFromQuizItems(items, filename) {
  if (!items.length) {
    alert("No Quiz Me cards found yet. Generate a Quiz Me set first to export Anki flashcards.");
    return;
  }
  const rows = ["Front,Back,Explanation"];
  for (const item of items) {
    const answer = item.options?.[item.answerIndex] || "";
    rows.push([csvEscape(item.q), csvEscape(answer), csvEscape(item.explanation || "")].join(","));
  }
  triggerDownload(filename, rows.join("\n"), "text/csv;charset=utf-8");
}

document.getElementById("export-anki-btn")?.addEventListener("click", () => {
  const chat = getActiveNote();
  const chatCards = [];
  for (const msg of chat?.messages || []) {
    if (Array.isArray(msg.quizItems)) chatCards.push(...msg.quizItems);
  }
  const items = chatCards.length ? chatCards : getStudyLoopItems(notes).map((x) => x.item);
  exportAnkiFromQuizItems(items, `${safeSlug(chat?.title)}-anki.csv`);
});

document.getElementById("study-loop-weak-btn")?.addEventListener("click", () => {
  openStudyLoop({ weakSpotOnly: true });
});

document.getElementById("study-loop-export-anki-btn")?.addEventListener("click", () => {
  const items = getStudyLoopItems(notes).map((x) => x.item);
  exportAnkiFromQuizItems(items, "hybridnotes-study-loop-anki.csv");
});

// === Why Hybrid? Live Split View Toggle ===
const toggleHybridCompareBtn = document.getElementById("toggle-hybrid-compare-btn");
const hybridCompareView = document.getElementById("hybrid-compare-view");
toggleHybridCompareBtn?.addEventListener("click", () => {
  if (!hybridCompareView) return;
  const nextHidden = !hybridCompareView.hidden;
  hybridCompareView.hidden = nextHidden;
  toggleHybridCompareBtn.setAttribute("aria-expanded", String(!nextHidden));
});

// === Live 3D Hero & Touchable Surface Controller ===
function initTouchable3DSurfaces() {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reducedMotion) return;

  const surfaces = document.querySelectorAll(
    ".hero-mockup, .bento-card, .experience-card-blue, .landing-title-tile"
  );

  surfaces.forEach((el) => {
    el.classList.add("touch-3d");
    const isTile = el.classList.contains("landing-title-tile");
    const maxTilt = isTile ? 10 : 5.5;
    let rafId = null;

    const updateTilt = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const tiltY = (px - 0.5) * maxTilt * 2;
      const tiltX = (0.5 - py) * maxTilt * 2;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        el.classList.add("is-interacting");
        el.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
        el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
        el.style.setProperty("--glow-opacity", "1");
      });
    };

    const resetTilt = () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.classList.remove("is-interacting");
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
      el.style.setProperty("--glow-opacity", "0");
    };

    el.addEventListener("pointermove", (e) => {
      updateTilt(e.clientX, e.clientY);
    });
    el.addEventListener("pointerdown", (e) => {
      updateTilt(e.clientX, e.clientY);
    });
    el.addEventListener("pointerleave", resetTilt);
    el.addEventListener("pointerup", resetTilt);
    el.addEventListener("pointercancel", resetTilt);
  });
}

initTouchable3DSurfaces();

document.getElementById("hero-demo-btn")?.addEventListener("click", () => openDemoModal(0));