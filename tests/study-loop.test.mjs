import test from "node:test";
import assert from "node:assert/strict";
import {
  getDueStudyLoopItems,
  getStudyLoopSummary,
  recordReviewOutcome,
  scheduleMissedQuizItem,
} from "../src/study-loop.js";

const DAY_MS = 24 * 60 * 60 * 1000;

test("schedules a missed quiz answer for tomorrow", () => {
  const item = {};
  const now = 1_800_000_000_000;

  scheduleMissedQuizItem(item, now);

  assert.equal(item.review.stage, 0);
  assert.equal(item.review.dueAt, now + DAY_MS);
  assert.equal(item.review.reviews, 0);
});

test("spaces remembered answers and resets missed reviews to tomorrow", () => {
  const item = { review: { stage: 0, reviews: 0 } };
  const now = 1_800_000_000_000;

  recordReviewOutcome(item, true, now);
  assert.equal(item.review.stage, 1);
  assert.equal(item.review.dueAt, now + 3 * DAY_MS);

  recordReviewOutcome(item, false, now);
  assert.equal(item.review.stage, 0);
  assert.equal(item.review.dueAt, now + DAY_MS);
  assert.equal(item.review.reviews, 2);
});

test("caps successful review spacing at fourteen days", () => {
  const item = { review: { stage: 3, reviews: 4 } };
  const now = 1_800_000_000_000;

  recordReviewOutcome(item, true, now);

  assert.equal(item.review.stage, 3);
  assert.equal(item.review.dueAt, now + 14 * DAY_MS);
});

test("collects due and upcoming quiz cards across saved notes", () => {
  const now = 1_800_000_000_000;
  const notes = [
    {
      title: "Biology",
      messages: [
        {
          quizItems: [
            { q: "Due", options: ["a", "b"], answerIndex: 0, review: { dueAt: now - 1, reviews: 0 } },
            { q: "Later", options: ["a", "b"], answerIndex: 1, review: { dueAt: now + 1, reviews: 1 } },
            { q: "No review", options: ["a", "b"], answerIndex: 1 },
          ],
        },
      ],
    },
  ];

  assert.equal(getDueStudyLoopItems(notes, now).length, 1);
  assert.deepEqual(getStudyLoopSummary(notes, now), {
    due: 1,
    upcoming: 1,
    completedReviews: 1,
    nextDueAt: now + 1,
  });
});
