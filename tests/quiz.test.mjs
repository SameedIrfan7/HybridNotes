import test from "node:test";
import assert from "node:assert/strict";
import { parseQuizJson, validateQuizJson, parseLegacyQuizText } from "../src/quiz.js";

const valid = {
  questions: [{
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    answerIndex: 1,
    explanation: "Two plus two equals four.",
  }],
};

test("parses valid structured quiz JSON", () => {
  assert.deepEqual(parseQuizJson(JSON.stringify(valid)), valid.questions);
});

test("strips code fences and parses structured quiz JSON", () => {
  assert.equal(parseQuizJson("```json\n" + JSON.stringify(valid) + "\n```")?.length, 1);
});

test("rejects malformed and incomplete structured quizzes", () => {
  assert.equal(parseQuizJson("{bad"), null);
  assert.equal(validateQuizJson({ questions: [{ question: "Q" }] }), null);
});

test("rejects wrong option counts and answer indexes", () => {
  assert.equal(validateQuizJson({ questions: [{ ...valid.questions[0], options: ["A", "B"] }] }), null);
  assert.equal(validateQuizJson({ questions: [{ ...valid.questions[0], answerIndex: 4 }] }), null);
});

test("falls back to legacy array text", () => {
  const legacy = [{ q: "Q?", options: ["A", "B", "C", "D"], answerIndex: 0, explanation: "A is correct." }];
  assert.deepEqual(parseLegacyQuizText(JSON.stringify(legacy)), legacy);
});
