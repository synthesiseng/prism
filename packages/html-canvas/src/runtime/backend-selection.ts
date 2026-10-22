import { nativeCapability } from "../experimental-types";
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
      throw new Error(
        nativeCapability(canvas, context) === "unsupported-version"
          ? "This HTML-in-Canvas API shape is unsupported. Legacy browsers require Prism 0.1.0-alpha.8."
          : "Native HTML-in-Canvas is not available in this browser."
      );
    }
  }

  return new FallbackCanvasBackend(() => canvas.ownerDocument.createElement("canvas"));
}
