const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14];

export function scheduleMissedQuizItem(item, reviewedAt = Date.now()) {
  item.review = {
    stage: 0,
    dueAt: reviewedAt + DAY_MS,
    reviews: 0,
    lastReviewedAt: null,
  };
  return item.review;
}

export function recordReviewOutcome(item, remembered, reviewedAt = Date.now()) {
  const previous = item.review || {};
  const previousStage =
    Number.isInteger(previous.stage) && previous.stage >= 0
      ? Math.min(previous.stage, REVIEW_INTERVAL_DAYS.length - 1)
      : 0;
  const stage = remembered
    ? Math.min(previousStage + 1, REVIEW_INTERVAL_DAYS.length - 1)
    : 0;
  const reviews =
    Number.isInteger(previous.reviews) && previous.reviews >= 0
      ? previous.reviews + 1
      : 1;

  item.review = {
    stage,
    dueAt: reviewedAt + REVIEW_INTERVAL_DAYS[stage] * DAY_MS,
    reviews,
    lastReviewedAt: reviewedAt,
  };
  return item.review;
}

export function getStudyLoopItems(notes) {
  const items = [];
  for (const note of Array.isArray(notes) ? notes : []) {
    for (const message of Array.isArray(note.messages) ? note.messages : []) {
      if (!Array.isArray(message.quizItems)) continue;
      for (const item of message.quizItems) {
        if (
          item &&
          typeof item.q === "string" &&
          Array.isArray(item.options) &&
          Number.isInteger(item.answerIndex) &&
          item.answerIndex >= 0 &&
          item.answerIndex < item.options.length &&
          Number.isFinite(item.review?.dueAt)
        ) {
          items.push({ item, noteTitle: note.title || "Untitled note" });
        }
      }
    }
  }
  return items;
}

export function getStudyLoopSummary(notes, now = Date.now()) {
  const items = getStudyLoopItems(notes);
  const dueItems = items.filter(({ item }) => item.review.dueAt <= now);
  const upcomingItems = items.filter(({ item }) => item.review.dueAt > now);
  const completedReviews = items.reduce(
    (total, { item }) => total + (Number.isInteger(item.review.reviews) ? item.review.reviews : 0),
    0
  );
  const nextDueAt = upcomingItems.length
    ? Math.min(...upcomingItems.map(({ item }) => item.review.dueAt))
    : null;

  return { due: dueItems.length, upcoming: upcomingItems.length, completedReviews, nextDueAt };
}

export function getDueStudyLoopItems(notes, now = Date.now()) {
  return getStudyLoopItems(notes)
    .filter(({ item }) => item.review.dueAt <= now)
    .sort((a, b) => a.item.review.dueAt - b.item.review.dueAt);
}
