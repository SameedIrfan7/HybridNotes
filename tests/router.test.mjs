import test from "node:test";
import assert from "node:assert/strict";
import { decideRoute } from "../src/router.js";
import { sanitizeForCloud, formatAIError } from "../src/ai.js";

// --- 1. Smart Router Guardrails ---
test("blocks empty or whitespace-only input", () => {
  const res = decideRoute({ task: "summarize", text: "   \n\t  " });
  assert.equal(res.blocked, true);
  assert.equal(res.mode, null);
  assert.match(res.reason, /Empty note/i);
});

test("blocks bare URLs with a helpful message", () => {
  const res = decideRoute({ task: "auto", text: "https://example.com/lecture-notes" });
  assert.equal(res.blocked, true);
  assert.equal(res.mode, null);
  assert.match(res.reason, /Links aren't fetched/i);
});

// --- 2. Private Mode Routing ---
test("locks Private notes to ONLY_ON_DEVICE for on-device tasks", () => {
  for (const task of ["auto", "ask", "summarize", "quiz", "grammar", "title", "todos"]) {
    const res = decideRoute({ task, text: "Private biology notes", isPrivate: true });
    assert.equal(res.blocked, undefined);
    assert.equal(res.mode, "ONLY_ON_DEVICE");
    assert.match(res.reason, /Private note/i);
  }
});

test("blocks cloud-only tasks when Private mode is ON", () => {
  for (const task of ["deep-analyze", "translate"]) {
    const res = decideRoute({ task, text: "Secret lecture notes", isPrivate: true });
    assert.equal(res.blocked, true);
    assert.equal(res.mode, null);
    assert.match(res.reason, /Refused/i);
  }
});

// --- 3. Offline Mode Routing ---
test("locks Offline mode to ONLY_ON_DEVICE for supported tasks", () => {
  const res = decideRoute({ task: "quiz", text: "ATP synthesis", isOffline: true });
  assert.equal(res.blocked, undefined);
  assert.equal(res.mode, "ONLY_ON_DEVICE");
  assert.match(res.reason, /Offline mode/i);
});

test("blocks cloud-only tasks when Offline", () => {
  const res = decideRoute({ task: "translate", text: "Hello world", isOffline: true });
  assert.equal(res.blocked, true);
  assert.equal(res.mode, null);
  assert.match(res.reason, /requires an internet connection/i);
});

// --- 4. Online Length & Task Routing ---
test("routes short notes (< maxOnDeviceChars) to PREFER_ON_DEVICE", () => {
  const res = decideRoute({
    task: "summarize",
    text: "Mitochondria generate ATP.",
    maxOnDeviceChars: 1500,
  });
  assert.equal(res.mode, "PREFER_ON_DEVICE");
  assert.match(res.reason, /Short note/i);
});

test("routes long notes (>= maxOnDeviceChars) to PREFER_IN_CLOUD", () => {
  const res = decideRoute({
    task: "summarize",
    text: "a".repeat(1500),
    maxOnDeviceChars: 1500,
  });
  assert.equal(res.mode, "PREFER_IN_CLOUD");
  assert.match(res.reason, /Long note/i);
});

test("respects custom Remote Config threshold", () => {
  const res = decideRoute({
    task: "auto",
    text: "a".repeat(600),
    maxOnDeviceChars: 500,
  });
  assert.equal(res.mode, "PREFER_IN_CLOUD");
});

test("routes cloud-only tasks to ONLY_IN_CLOUD when online and non-private", () => {
  for (const task of ["deep-analyze", "translate"]) {
    const res = decideRoute({ task, text: "Short text", isPrivate: false, isOffline: false });
    assert.equal(res.mode, "ONLY_IN_CLOUD");
  }
});

// --- 5. Local Identifier Redaction (sanitizeForCloud) ---
test("masks emails, phone numbers, and 6+ digit student IDs locally", () => {
  const input =
    "Contact sara.khan@uni.edu or +1 (555) 234-5678, student ID 20264819, room 104.";
  const { sanitizedText, maskedCount, summary } = sanitizeForCloud(input);

  assert.equal(maskedCount, 3);
  assert.equal(summary, "1 email, 1 phone, 1 ID masked locally");
  assert.ok(!sanitizedText.includes("sara.khan@uni.edu"));
  assert.ok(!sanitizedText.includes("555"));
  assert.ok(!sanitizedText.includes("20264819"));
  assert.ok(sanitizedText.includes("[REDACTED_EMAIL]"));
  assert.ok(sanitizedText.includes("[REDACTED_PHONE]"));
  assert.ok(sanitizedText.includes("[REDACTED_ID]"));
  assert.ok(sanitizedText.includes("room 104"));
});

test("leaves clean study notes untouched with empty summary", () => {
  const input = "Newton's second law states F = m * a.";
  const { sanitizedText, maskedCount, summary } = sanitizeForCloud(input);
  assert.equal(sanitizedText, input);
  assert.equal(maskedCount, 0);
  assert.equal(summary, "");
});

// --- 6. Friendly Cloud & Device Error Formatting ---
test("maps 429/quota errors to friendly message without raw details", () => {
  const msg = formatAIError(new Error("429 RESOURCE_EXHAUSTED quota exceeded"), "ONLY_IN_CLOUD");
  assert.equal(
    msg,
    "Cloud is busy right now. Try again in a minute, or use on-device on desktop Chrome."
  );
});

test("maps App Check 403 errors to friendly message", () => {
  const msg = formatAIError(new Error("AppCheck 403 Forbidden"), "ONLY_IN_CLOUD");
  assert.match(msg, /App Check verification failed/i);
});

test("maps Private/ONLY_ON_DEVICE unavailable errors clearly", () => {
  const msg = formatAIError(new Error("LanguageModel unavailable"), "ONLY_ON_DEVICE");
  assert.equal(msg, "Private mode needs desktop Chrome with Gemini Nano.");
});