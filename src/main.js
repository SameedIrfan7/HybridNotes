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
const DEFAULT_TITLE = "New Study Note";

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
const privateToggle = document.getElementById("private-toggle");
const contentInput = document.getElementById("note-content");
const charCountEl = document.getElementById("char-count");
const actionBtns = document.querySelectorAll(".action-btn");
const translateLangEl = document.getElementById("translate-lang");
const taskMenuBtn = document.getElementById("task-menu-btn");
const taskPopover = document.getElementById("task-popover");
const selectedTaskChip = document.getElementById("selected-task-chip");
const runAiBtn = document.getElementById("run-ai-btn");
const cancelAiBtn = document.getElementById("cancel-ai-btn");

const resultCard = document.getElementById("result-card");
const routeBadge = document.getElementById("route-badge");
const sanitizedBadge = document.getElementById("sanitized-badge");
const resultLatency = document.getElementById("result-latency");
const routeReason = document.getElementById("route-reason");
const resultBody = document.getElementById("result-body");

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

let notes = loadNotes();
let activeId = notes[0]?.id || null;
let stats = loadStats();
let maxOnDeviceChars = 1500;
let selectedTask = "summarize";
let activeAbortController = null;
let slideIndex = 0;
let carouselPaused = false;

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

function setPopoverOpen(open) {
  taskPopover.hidden = !open;
  taskMenuBtn.setAttribute("aria-expanded", String(open));
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
  syncViewLayout();
  if (!isHome) autoResizeEditor();
}

function isAppOffline() {
  return !navigator.onLine || simOfflineToggle.checked;
}

function autoResizeEditor() {
  contentInput.style.height = "auto";
  contentInput.style.height = `${Math.min(contentInput.scrollHeight, 200)}px`;
}

function deriveTitle(content) {
  const firstLine = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return DEFAULT_TITLE;
  return firstLine.length > 42 ? `${firstLine.slice(0, 42)}…` : firstLine;
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
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title: initial.title || DEFAULT_TITLE,
    content: initial.content || "",
    isPrivate: Boolean(initial.isPrivate),
    autoTitled: initial.title ? false : true,
    updatedAt: Date.now(),
  };
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore malformed localStorage and fall back to starter note.
  }
  const starter = createNote({
    title: "Biology Lecture — Cell Respiration",
    content:
      "Cellular respiration converts glucose into ATP across three stages: glycolysis in the cytoplasm, the Krebs cycle in the mitochondrial matrix, and oxidative phosphorylation along the inner membrane.",
  });
  localStorage.setItem(NOTES_KEY, JSON.stringify([starter]));
  return [starter];
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
  statOnDeviceMeta.textContent = `${stats.onDeviceCount} · ${onAvg !== null ? `${onAvg} ms` : "—"}`;
  statCloudMeta.textContent = `${stats.cloudCount} · ${cloudAvg !== null ? `${cloudAvg} ms` : "—"}`;
  statOnDeviceBar.style.width = `${onPct}%`;
  statCloudBar.style.width = `${cloudPct}%`;

  modalOnDevicePct.textContent = `${onPct}%`;
  modalAvoided.textContent = String(stats.cloudCallsAvoided);
  modalKbSaved.textContent = `${kbSaved} KB`;
  modalThreshold.textContent = `${maxOnDeviceChars} chars`;
  modalOnDeviceDetail.textContent = `${stats.onDeviceCount} runs · ${onAvg !== null ? `${onAvg} ms avg` : "—"}`;
  modalCloudDetail.textContent = `${stats.cloudCount} runs · ${cloudAvg !== null ? `${cloudAvg} ms avg` : "—"}`;
}

async function refreshNanoStatus() {
  const status = await getOnDeviceStatus();
  const pills = [nanoStatusPill, mobileNanoStatusPill].filter(Boolean);
  for (const pill of pills) {
    pill.classList.remove("nano-ready", "nano-warn");
    if (status === "available") {
      pill.textContent = "Gemini Nano ready";
      pill.classList.add("nano-ready");
    } else if (status === "downloading" || status === "downloadable") {
      pill.textContent = "Gemini Nano downloading";
      pill.classList.add("nano-warn");
    } else {
      pill.textContent = "Nano unavailable · using cloud";
      pill.classList.add("nano-warn");
    }
  }
}

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

function renderEditor() {
  const note = getActiveNote();
  if (!note) return;
  titleInput.value = note.title;
  contentInput.value = note.content;
  privateToggle.checked = note.isPrivate;
  charCountEl.textContent = `${note.content.trim().length} chars`;
  autoResizeEditor();
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
      return `Create 3-4 concise study flashcards (Q: ... / A: ...) to test understanding of these notes:\n\n${text}`;
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

function showResult({
  badgeText,
  badgeClass,
  privacySummary = "",
  latencyText,
  reason,
  body,
}) {
  resultCard.hidden = false;
  routeBadge.textContent = badgeText;
  routeBadge.className = `badge ${badgeClass}`;

  if (privacySummary) {
    sanitizedBadge.hidden = false;
    sanitizedBadge.textContent = privacySummary;
  } else {
    sanitizedBadge.hidden = true;
    sanitizedBadge.textContent = "";
  }

  resultLatency.textContent = latencyText;
  routeReason.textContent = reason;
  resultBody.textContent = body;
}

function setRunning(running) {
  runAiBtn.disabled = running;
  taskMenuBtn.disabled = running;
  cancelAiBtn.hidden = !running;
}

async function handleRun() {
  const note = getActiveNote();
  if (!note || activeAbortController) return;
  setPopoverOpen(false);

  const text = note.content.trim();
  const task = selectedTask;
  const route = decideRoute({
    task,
    text,
    isPrivate: note.isPrivate,
    isOffline: isAppOffline(),
    maxOnDeviceChars,
  });

  if (route.blocked || !route.mode) {
    showResult({
      badgeText: "Blocked",
      badgeClass: "badge-blocked",
      latencyText: "",
      reason: route.reason,
      body: "",
    });
    return;
  }

  activeAbortController = new AbortController();
  const { signal } = activeAbortController;

  setRunning(true);
  const preferLocal = route.mode.includes("ON_DEVICE");
  showResult({
    badgeText: "Running...",
    badgeClass: preferLocal ? "badge-on-device" : "badge-cloud",
    latencyText: "",
    reason: route.reason,
    body: "Generating response...",
  });

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
          resultBody.textContent = msg;
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

      res = await runAI({
        prompt: buildPrompt(task, inputText),
        mode: route.mode,
        signal,
        onDownloadProgress: (pct) => {
          resultBody.textContent = `Downloading on-device model: ${pct}%`;
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

    showResult({
      badgeText: isOnDevice ? "On-device" : "Cloud",
      badgeClass: isOnDevice ? "badge-on-device" : "badge-cloud",
      privacySummary: !isOnDevice ? privacySummary : "",
      latencyText: `${res.ms} ms`,
      reason: reasonText,
      body: res.text,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      showResult({
        badgeText: "Cancelled",
        badgeClass: "badge-blocked",
        latencyText: "",
        reason: "Stopped by user. Your notes are untouched.",
        body: "",
      });
    } else {
      showResult({
        badgeText: "Error",
        badgeClass: "badge-blocked",
        latencyText: "",
        reason: route.reason,
        body: err?.message || "AI request failed. Your notes are saved locally.",
      });
    }
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

document.addEventListener("click", (e) => {
  if (!taskPopover.hidden && !taskPopover.contains(e.target) && e.target !== taskMenuBtn) {
    setPopoverOpen(false);
  }
});

newNoteBtn.addEventListener("click", () => {
  const note = createNote();
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
  note.content = contentInput.value;
  if (note.autoTitled) {
    note.title = deriveTitle(note.content);
    titleInput.value = note.title;
  }
  note.updatedAt = Date.now();
  charCountEl.textContent = `${note.content.trim().length} chars`;
  autoResizeEditor();
  saveNotes();
  if (note.autoTitled) renderSidebar();
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

initCarousel();
initScrollReveals();
syncViewLayout();
updateOfflineBanner();
updateSelectedChip();
renderAll();