const ON_DEVICE_TASKS = new Set([
  "summarize",
  "grammar",
  "title",
  "todos",
  "quiz",
]);
const CLOUD_ONLY_TASKS = new Set(["deep-analyze", "translate"]);
const BARE_URL_RE = /^https?:\/\/\S+$/i;

/**
 * Decides the Firebase AI Logic InferenceMode and a one-line human-readable reason.
 * @param {{
 *   task: "summarize" | "grammar" | "title" | "todos" | "quiz" | "deep-analyze" | "translate",
 *   text: string,
 *   isPrivate?: boolean,
 *   isOffline?: boolean,
 *   maxOnDeviceChars?: number,
 * }} params
 * @returns {{ mode: "ONLY_ON_DEVICE" | "PREFER_ON_DEVICE" | "PREFER_IN_CLOUD" | "ONLY_IN_CLOUD" | null, blocked?: boolean, reason: string }}
 */
export function decideRoute({
  task,
  text = "",
  isPrivate = false,
  isOffline = false,
  maxOnDeviceChars = 1500,
}) {
  const trimmed = text.trim();
  const charCount = trimmed.length;

  if (!charCount) {
    return {
      mode: null,
      blocked: true,
      reason: "Empty note: write or paste your study notes first.",
    };
  }

  if (BARE_URL_RE.test(trimmed)) {
    return {
      mode: null,
      blocked: true,
      reason:
        "Links aren't fetched—paste the article or lecture text instead so HybridNotes can process it accurately.",
    };
  }

  if (isPrivate) {
    if (CLOUD_ONLY_TASKS.has(task)) {
      return {
        mode: null,
        blocked: true,
        reason: `Refused: "${task}" requires the cloud, and Private mode keeps this note on-device only.`,
      };
    }
    return {
      mode: "ONLY_ON_DEVICE",
      reason: "Private note: locked to on-device AI so nothing leaves your device.",
    };
  }

  if (isOffline) {
    if (CLOUD_ONLY_TASKS.has(task)) {
      return {
        mode: null,
        blocked: true,
        reason: `Refused: "${task}" requires an internet connection. Try Summarize, Grammar, Title, To-dos, or Quiz Me offline.`,
      };
    }
    return {
      mode: "ONLY_ON_DEVICE",
      reason: "Offline mode: running strictly on-device with no mobile data used.",
    };
  }

  if (CLOUD_ONLY_TASKS.has(task)) {
    return {
      mode: "ONLY_IN_CLOUD",
      reason: `"${task}" requires full cloud Gemini reasoning.`,
    };
  }

  if (charCount < maxOnDeviceChars && ON_DEVICE_TASKS.has(task)) {
    return {
      mode: "PREFER_ON_DEVICE",
      reason: `Short note (${charCount} chars < ${maxOnDeviceChars}): preferring fast, zero-data on-device AI.`,
    };
  }

  return {
    mode: "PREFER_IN_CLOUD",
    reason: `Long note (${charCount} chars >= ${maxOnDeviceChars}): preferring cloud Gemini for better quality.`,
  };
}

/*
 * 6 simple unit-test examples:
 *
 * 1. Offline + summarize:
 *    decideRoute({ task: "summarize", text: "Short note", isPrivate: false, isOffline: true })
 *    // => { mode: "ONLY_ON_DEVICE", reason: "Offline mode: running strictly on-device with no mobile data used." }
 *
 * 2. Private + grammar:
 *    decideRoute({ task: "grammar", text: "My private diary", isPrivate: true, isOffline: false })
 *    // => { mode: "ONLY_ON_DEVICE", reason: "Private note: locked to on-device AI so nothing leaves your device." }
 *
 * 3. Private + deep-analyze (refused):
 *    decideRoute({ task: "deep-analyze", text: "Secret study notes", isPrivate: true, isOffline: false })
 *    // => { mode: null, blocked: true, reason: 'Refused: "deep-analyze" requires the cloud, and Private mode keeps this note on-device only.' }
 *
 * 4. Cloud-only task (translate) while online & not private:
 *    decideRoute({ task: "translate", text: "Hello world", isPrivate: false, isOffline: false })
 *    // => { mode: "ONLY_IN_CLOUD", reason: '"translate" requires full cloud Gemini reasoning.' }
 *
 * 5. Short note (< 1500 chars) + quiz:
 *    decideRoute({ task: "quiz", text: "ATP is cellular energy", isPrivate: false, isOffline: false })
 *    // => { mode: "PREFER_ON_DEVICE", reason: "Short note (22 chars < 1500): preferring fast, zero-data on-device AI." }
 *
 * 6. Long note (>= 1500 chars) + summarize:
 *    decideRoute({ task: "summarize", text: "a".repeat(1600), isPrivate: false, isOffline: false })
 *    // => { mode: "PREFER_IN_CLOUD", reason: "Long note (1600 chars >= 1500): preferring cloud Gemini for better quality." }
 */