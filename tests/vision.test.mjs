import test from "node:test";
import assert from "node:assert/strict";
import { extractText } from "../src/vision.js";

test("vision adapter maps engine output to text and lines", async () => {
  const engine = {
    async extractText(image, options) {
      assert.equal(image, "photo");
      options.onProgress?.(100);
      return { text: "A study note", lines: [{ text: "A study note", confidence: 98 }] };
    },
  };
  const result = await extractText("photo", {}, engine);
  assert.deepEqual(result, { text: "A study note", lines: [{ text: "A study note", confidence: 98 }] });
});
