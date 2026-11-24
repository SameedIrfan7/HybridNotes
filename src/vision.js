export function createTesseractEngine() {
  return {
    async extractText(image, options = {}) {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(options.lang || "eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
      });
      try {
        options.onProgress?.(5);
        const result = await worker.recognize(image);
        const lines = (result.data?.lines || []).map((line) => ({
          text: line.text || "",
          confidence: line.confidence,
        }));
        options.onProgress?.(100);
        return { text: result.data?.text || "", lines };
      } finally {
        await worker.terminate();
      }
    },
  };
}

export async function extractText(image, options = {}, engine = createTesseractEngine()) {
  return engine.extractText(image, options);
}
