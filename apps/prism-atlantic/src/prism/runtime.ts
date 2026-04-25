import { CanvasRuntime } from "@synthesisengineering/prism";

export function createAtlanticRuntime(canvas: HTMLCanvasElement): CanvasRuntime {
  // The example opts into Prism's normal backend policy. Native HTML-in-Canvas
  // is preferred; fallback only keeps the app understandable in unsupported browsers.
  return new CanvasRuntime(canvas, { backend: "auto" });
}
