import { CanvasRuntime } from "@synthesisengineering/prism";

export function createAtelierRuntime(canvas: HTMLCanvasElement): CanvasRuntime {
  // Atelier asks Prism to prefer the native HTML-in-Canvas backend and lets the
  // app show an explicit support gate if the browser can only provide fallback.
  return new CanvasRuntime(canvas, { backend: "auto" });
}
