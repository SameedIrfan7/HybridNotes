export const QUIZ_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4,
          },
          answerIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
        },
        required: ["question", "options", "answerIndex", "explanation"],
      },
    },
  },
  required: ["questions"],
};

export function stripJsonCodeFence(raw) {
  return String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function validateQuizJson(value) {
  if (!value || !Array.isArray(value.questions) || value.questions.length === 0) return null;
  const questions = value.questions.filter((item) => {
    return (
      item &&
      typeof item.question === "string" &&
      item.question.trim().length > 0 &&
      Array.isArray(item.options) &&
      item.options.length === 4 &&
      item.options.every((option) => typeof option === "string" && option.trim().length > 0) &&
      Number.isInteger(item.answerIndex) &&
      item.answerIndex >= 0 &&
      item.answerIndex <= 3 &&
      typeof item.explanation === "string" &&
      item.explanation.trim().length > 0
    );
  });
  return questions.length === value.questions.length && questions.length > 0 ? questions : null;
}

export function parseQuizJson(raw) {
  const cleaned = stripJsonCodeFence(raw);
  try {
    return validateQuizJson(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

export function parseLegacyQuizText(raw) {
  const cleaned = stripJsonCodeFence(raw);
  try {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const valid = parsed.filter((item) =>
      item &&
      typeof item.q === "string" &&
      item.q.trim() &&
      Array.isArray(item.options) &&
      item.options.length >= 2 &&
      item.options.every((option) => typeof option === "string" && option.trim()) &&
      Number.isInteger(item.answerIndex) &&
      item.answerIndex >= 0 &&
      item.answerIndex < item.options.length &&
      typeof item.explanation === "string"
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}
