export function ensureCanvasPolyfills(): void {
  if (typeof globalThis.DOMMatrix === "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const canvas = require("canvas");
      if (canvas.DOMMatrix) {
        globalThis.DOMMatrix = canvas.DOMMatrix;
      }
      if (canvas.ImageData && typeof globalThis.ImageData === "undefined") {
        globalThis.ImageData = canvas.ImageData;
      }
    } catch {
      // canvas not available, skip polyfill
    }
  }
}

