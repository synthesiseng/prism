import type { RuntimeBackend } from "../backend";
import { FallbackCanvasBackend } from "../backends/fallback-backend";
import { NativeHtmlCanvasBackend } from "../backends/native-backend";

export type RuntimeBackendKind = RuntimeBackend["kind"];
export type RuntimeBackendPreference = "auto" | RuntimeBackendKind;

export function selectRuntimeBackend(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  preference: RuntimeBackendPreference | undefined
): RuntimeBackend {
  if (!preference || preference === "auto" || preference === "native") {
    const nativeBackend = new NativeHtmlCanvasBackend();
    if (nativeBackend.isSupported(canvas, context)) {
      return nativeBackend;
    }
    if (preference === "native") {
      throw new Error("Native HTML-in-Canvas is not available in this browser.");
    }
  }

  return new FallbackCanvasBackend(() => canvas.ownerDocument.createElement("canvas"));
}
