export function ensureDOMMatrix(): void {
  if (typeof globalThis.DOMMatrix === "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DOMMatrix } = require("canvas");
      globalThis.DOMMatrix = DOMMatrix as typeof globalThis.DOMMatrix;
    } catch {
      // canvas not available, skip polyfill
    }
  }
}

