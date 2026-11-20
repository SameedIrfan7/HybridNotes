import test from "node:test";
import assert from "node:assert/strict";
import {
  scheduleMissedQuizItem,
  recordReviewOutcome,
  getStudyLoopSummary,
  getDueStudyLoopItems,
} from "../src/study-loop.js";

const DAY_MS = 24 * 60 * 60 * 1000;

test("schedules missed quiz item for review tomorrow (stage 0)", () => {
  const now = 1_700_000_000_000;
  const item = { q: "What is ATP?", options: ["Energy", "Lipid"], answerIndex: 0 };
  const review = scheduleMissedQuizItem(item, now);

  assert.equal(review.stage, 0);
  assert.equal(review.reviews, 0);
  assert.equal(review.dueAt, now + DAY_MS);
});

test("spaces intervals across 3, 7, and 14 days when remembered", () => {
  const t0 = 1_700_000_000_000;
  const item = { q: "Q1", options: ["A", "B"], answerIndex: 0 };
  scheduleMissedQuizItem(item, t0);

  const r1 = recordReviewOutcome(item, true, t0 + DAY_MS);
  assert.equal(r1.stage, 1);
  assert.equal(r1.dueAt, t0 + DAY_MS + 3 * DAY_MS);
  assert.equal(r1.reviews, 1);

  const r2 = recordReviewOutcome(item, true, r1.dueAt);
  assert.equal(r2.stage, 2);
  assert.equal(r2.dueAt, r1.dueAt + 7 * DAY_MS);

  const r3 = recordReviewOutcome(item, true, r2.dueAt);
  assert.equal(r3.stage, 3);
  assert.equal(r3.dueAt, r2.dueAt + 14 * DAY_MS);

  // Caps at stage 3 (14 days)
  const r4 = recordReviewOutcome(item, true, r3.dueAt);
  assert.equal(r4.stage, 3);
  assert.equal(r4.dueAt, r3.dueAt + 14 * DAY_MS);
});

test("resets stage to 0 (1 day) when forgotten during review", () => {
  const t0 = 1_700_000_000_000;
  const item = {
    q: "Q2",
    options: ["A", "B"],
    answerIndex: 1,
    review: { stage: 2, dueAt: t0, reviews: 2, lastReviewedAt: t0 - 7 * DAY_MS },
  };

  const res = recordReviewOutcome(item, false, t0);
  assert.equal(res.stage, 0);
  assert.equal(res.dueAt, t0 + DAY_MS);
  assert.equal(res.reviews, 3);
});

test("summarizes due vs upcoming items and sorts due queue oldest-first", () => {
  const now = 1_700_000_000_000;
  const notes = [
    {
      title: "Biology",
      messages: [
        {
          quizItems: [
            { q: "Due older", options: ["A", "B"], answerIndex: 0, review: { stage: 0, dueAt: now - 5000, reviews: 1 } },
            { q: "Due newer", options: ["A", "B"], answerIndex: 0, review: { stage: 0, dueAt: now - 1000, reviews: 0 } },
            { q: "Future", options: ["A", "B"], answerIndex: 0, review: { stage: 1, dueAt: now + DAY_MS, reviews: 2 } },
          ],
        },
      ],
    },
  ];

  const summary = getStudyLoopSummary(notes, now);
  assert.equal(summary.due, 2);
  assert.equal(summary.upcoming, 1);
  assert.equal(summary.completedReviews, 3);
  assert.equal(summary.nextDueAt, now + DAY_MS);

  const queue = getDueStudyLoopItems(notes, now);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].item.q, "Due older");
  assert.equal(queue[1].item.q, "Due newer");
});