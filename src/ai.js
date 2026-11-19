import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";
import {
  getRemoteConfig,
  fetchAndActivate,
  getNumber,
} from "firebase/remote-config";

const firebaseConfig = {
  apiKey: "AIzaSyAkBIA-1VZhfXq-Lu5JCAh_Gld2HBbGcK4",
  authDomain: "hybrid-3dd4b.firebaseapp.com",
  projectId: "hybrid-3dd4b",
  storageBucket: "hybrid-3dd4b.firebasestorage.app",
  messagingSenderId: "355630928254",
  appId: "1:355630928254:web:d64700b472feaf69f8232f",
  measurementId: "G-S877EEDQ7J",
};

const app = initializeApp(firebaseConfig);

// App Check is required by Firebase AI Logic.
// In local dev, set VITE_RECAPTCHA_SITE_KEY in .env (gitignored) and register
// the debug token printed to the browser console in Firebase Console > App Check.
if (import.meta.env.DEV) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

const remoteConfig = getRemoteConfig(app);
remoteConfig.defaultConfig = { on_device_max_chars: 1500 };
remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV
  ? 60_000
  : 300_000;

/**
 * Fetches the routing character threshold from Firebase Remote Config,
 * falling back to cached/default (1500) when offline.
 * @returns {Promise<number>}
 */
export async function getMaxOnDeviceChars() {
  try {
    if (navigator.onLine) {
      await fetchAndActivate(remoteConfig);
    }
  } catch {
    // Offline or Remote Config unavailable: use cached/default value.
  }
  const value = getNumber(remoteConfig, "on_device_max_chars");
  return value > 0 ? value : 1500;
}

const ai = getAI(app, { backend: new GoogleAIBackend() });

const CLOUD_MODEL = "gemini-3.5-flash-lite";

const models = {
  PREFER_ON_DEVICE: getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: { model: CLOUD_MODEL },
  }),
  ONLY_IN_CLOUD: getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL },
  }),
  ONLY_ON_DEVICE: getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
  }),
  PREFER_IN_CLOUD: getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL },
  }),
};

let deviceInitPromise = null;
let cachedNanoSession = null;

/**
 * Checks Chrome's built-in LanguageModel availability if present.
 * @returns {Promise<"available" | "downloading" | "downloadable" | "unavailable">}
 */
export async function getOnDeviceStatus() {
  try {
    if (typeof LanguageModel === "undefined" || !LanguageModel.availability) {
      return "unavailable";
    }
    return await LanguageModel.availability();
  } catch {
    return "unavailable";
  }
}

/**
 * Masks sensitive identifiers (emails, phone numbers, 6+ digit IDs) locally
 * before any cloud call and returns a human-readable privacy report.
 * @param {string} text
 * @returns {{ sanitizedText: string, maskedCount: number, summary: string }}
 */
export function sanitizeForCloud(text) {
  let emails = 0;
  let phones = 0;
  let ids = 0;

  let sanitizedText = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    () => {
      emails += 1;
      return "[REDACTED_EMAIL]";
    }
  );
  sanitizedText = sanitizedText.replace(
    /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
    () => {
      phones += 1;
      return "[REDACTED_PHONE]";
    }
  );
  sanitizedText = sanitizedText.replace(/\b\d{6,}\b/g, () => {
    ids += 1;
    return "[REDACTED_ID]";
  });

  const parts = [];
  if (emails) parts.push(`${emails} ${emails === 1 ? "email" : "emails"}`);
  if (phones) parts.push(`${phones} ${phones === 1 ? "phone" : "phones"}`);
  if (ids) parts.push(`${ids} ${ids === 1 ? "ID" : "IDs"}`);

  const maskedCount = emails + phones + ids;
  const summary = maskedCount ? `${parts.join(", ")} masked locally` : "";

  return { sanitizedText, maskedCount, summary };
}

/**
 * Ensures Chrome's on-device model is initialized before running an on-device request.
 * @param {(percent: number) => void} [onProgress]
 */
async function getBaseNanoSession(onProgress, allowDownload = false) {
  if (cachedNanoSession) return cachedNanoSession;
  if (typeof LanguageModel !== "undefined" && LanguageModel.create) {
    const status = await getOnDeviceStatus();
    const canStart =
      status === "available" ||
      (allowDownload && (status === "downloading" || status === "downloadable") && navigator.onLine);
    if (canStart) {
      cachedNanoSession = await LanguageModel.create({
        monitor(m) {
          if (typeof onProgress === "function" && status !== "available") {
            m.addEventListener("downloadprogress", (e) => {
              if (typeof e.loaded === "number" && e.loaded < 1) {
                onProgress(Math.round(e.loaded * 100));
              }
            });
          }
        },
      });
      return cachedNanoSession;
    }
  }
  return null;
}

export async function initOnDeviceModel(onProgress, { allowDownload = false } = {}) {
  if (!deviceInitPromise || allowDownload) {
    deviceInitPromise = getBaseNanoSession(onProgress, allowDownload).then((session) => {
      if (!session) deviceInitPromise = null;
      return session;
    }).catch((err) => {
      deviceInitPromise = null;
      cachedNanoSession = null;
      throw err;
    });
  }
  return deviceInitPromise;
}

function raceWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener("abort", onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      }
    );
  });
}

/**
 * Converts raw SDK/network errors into friendly messages without losing user text.
 * @param {unknown} err
 * @param {string} mode
 * @returns {string}
 */
export function formatAIError(err, mode) {
  if (err?.name === "AbortError") {
    return "Generation cancelled.";
  }

  const msg = String(err?.message || err || "").toLowerCase();

  if (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate") ||
    msg.includes("resource_exhausted")
  ) {
    return "Cloud rate limit or quota reached. Toggle Private (on-device only) or shorten your note to run locally with zero cloud calls.";
  }

  if (
    !navigator.onLine ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("offline")
  ) {
    return "Network connection failed. Your note is saved locally—use Summarize, Fix grammar, Suggest title, Extract to-dos, or Quiz Me to run on-device.";
  }

  if (msg.includes("timed out") || msg.includes("timeout")) {
    return "On-device Gemini Nano timed out. Try a shorter note or retry in a moment.";
  }

  if (
    mode === "ONLY_ON_DEVICE" ||
    msg.includes("on-device") ||
    msg.includes("languagemodel") ||
    msg.includes("unavailable")
  ) {
    return "On-device AI is unavailable in this browser (requires Chrome Desktop 139+ with Gemini Nano). Turn off Private mode while online to allow cloud fallback.";
  }

  if (msg.includes("appcheck") || msg.includes("403")) {
    return "App Check verification failed. Register your debug token in Firebase Console or reload the page.";
  }

  return err?.message || "AI request failed. Your notes are safely saved locally.";
}

/**
 * Runs a prompt through Firebase AI Logic with optional AbortSignal support.
 * @param {{ prompt: string, mode?: keyof typeof models, onDownloadProgress?: (pct: number) => void, signal?: AbortSignal }} params
 * @returns {Promise<{ text: string, source: "on-device" | "cloud", ms: number }>}
 */
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runNativeOnDevice(prompt, signal, onDownloadProgress, onStatus, onStream) {
  if (typeof LanguageModel === "undefined" || !LanguageModel.create) {
    throw new Error("Chrome LanguageModel API is unavailable.");
  }
  onStatus?.("Loading local Gemini Nano session…");
  const session = await withTimeout(
    initOnDeviceModel(onDownloadProgress),
    45_000,
    "On-device model timed out while loading."
  );
  if (!session) {
    throw new Error("Chrome LanguageModel session unavailable.");
  }

  try {
    onStatus?.("Thinking on Gemini Nano (0 KB data)…");
    if (typeof session.promptStreaming === "function" && typeof onStream === "function") {
      const stream = session.promptStreaming(prompt, { signal });
      let fullText = "";
      const consumeStream = (async () => {
        for await (const chunk of stream) {
          if (signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          if (typeof chunk === "string") {
            if (fullText && chunk.startsWith(fullText)) {
              fullText = chunk;
            } else {
              fullText += chunk;
            }
            onStream(fullText);
          }
        }
        return fullText;
      })();
      return await withTimeout(
        raceWithAbort(consumeStream, signal),
        60_000,
        "On-device generation timed out."
      );
    }

    const text = await withTimeout(
      raceWithAbort(session.prompt(prompt, { signal }), signal),
      60_000,
      "On-device generation timed out."
    );
    return text;
  } catch (err) {
    if (err?.name !== "AbortError") {
      try {
        session.destroy?.();
      } catch {
        // Ignore cleanup errors.
      }
      cachedNanoSession = null;
      deviceInitPromise = null;
    }
    throw err;
  }
}

export async function runAI({
  prompt,
  mode = "PREFER_ON_DEVICE",
  onDownloadProgress,
  onStatus,
  onStream,
  signal,
}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Please write or paste some study notes first.");
  }

  const start = performance.now();

  if (mode === "ONLY_ON_DEVICE" || mode === "PREFER_ON_DEVICE") {
    onStatus?.("Checking local Gemini Nano…");
    const nanoStatus = await getOnDeviceStatus();

    if (nanoStatus === "available") {
      try {
        const text = await runNativeOnDevice(prompt, signal, onDownloadProgress, onStatus, onStream);
        return {
          text,
          source: "on-device",
          ms: Math.round(performance.now() - start),
        };
      } catch (nativeErr) {
        if (nativeErr?.name === "AbortError") throw nativeErr;
        if (mode === "ONLY_ON_DEVICE") {
          throw new Error(formatAIError(nativeErr, mode));
        }
        onStatus?.("Local Nano unavailable — switching to Cloud Flash-Lite…");
      }
    } else if (mode === "ONLY_ON_DEVICE") {
      if (nanoStatus === "downloadable" || nanoStatus === "downloading") {
        throw new Error(
          "To use HybridNotes offline or Private on-device, click 'Enable Offline AI (~1.5 GB)' in the top bar to download Gemini Nano locally once."
        );
      }
      throw new Error(formatAIError(new Error("unavailable"), mode));
    } else {
      onStatus?.(
        nanoStatus === "downloadable"
          ? "Offline AI not downloaded yet — using Cloud Flash-Lite…"
          : "Nano unavailable — switching to Cloud Flash-Lite…"
      );
    }
  } else {
    onStatus?.("Connecting to Cloud Gemini Flash-Lite…");
  }

  const cloudModel =
    mode === "PREFER_ON_DEVICE" ? models.ONLY_IN_CLOUD : models[mode] || models.ONLY_IN_CLOUD;

  try {
    onStatus?.("Thinking & compiling response on Cloud Flash-Lite…");
    const result = await withTimeout(
      raceWithAbort(cloudModel.generateContent(prompt), signal),
      30_000,
      "Cloud request timed out. Please check your connection and try again."
    );
    const response = result.response;
    const ms = Math.round(performance.now() - start);

    const source = response.inferenceSource === "ON_DEVICE" ? "on-device" : "cloud";
    return {
      text: response.text(),
      source,
      ms,
    };
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new Error(formatAIError(err, mode));
  }
}

/**
 * Splits long notes into ~1200-char chunks and runs Map-Reduce strictly on-device.
 * @param {{ text: string, task: "summarize" | "todos", onProgress?: (step: string) => void, signal?: AbortSignal }} params
 * @returns {Promise<{ text: string, source: "on-device", ms: number, chunks: number }>}
 */
export async function runChunkedOnDevice({ text, task, onProgress, signal }) {
  const CHUNK_SIZE = 1200;
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }

  const start = performance.now();
  const partials = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (typeof onProgress === "function") {
      onProgress(`Processing chunk ${i + 1}/${chunks.length} on-device...`);
    }
    const prompt =
      task === "todos"
        ? `Extract key study to-dos from this excerpt as concise bullets:\n\n${chunks[i]}`
        : `Summarize the key points from this excerpt in 2-3 concise bullets:\n\n${chunks[i]}`;
    const res = await runAI({ prompt, mode: "ONLY_ON_DEVICE", signal });
    partials.push(res.text.trim());
  }

  return {
    text: partials.join("\n\n"),
    source: "on-device",
    ms: Math.round(performance.now() - start),
    chunks: chunks.length,
  };
}