import type { CanvasRuntime } from "@synthesisengineering/prism";
import type { StageFormat } from "./types";

export async function exportCanvasPng(
  runtime: CanvasRuntime,
  canvas: HTMLCanvasElement,
  format: StageFormat
): Promise<void> {
  if ("fonts" in document) {
    await document.fonts.ready;
  }

  // Prism provides paint readiness. The actual PNG still comes from the normal
  // canvas export API after the runtime-owned paint pass is complete.
  await runtime.paintOnce();
  const blob = await canvasToBlob(canvas);
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);

  try {
    link.download = `prism-${format.id}-${String(Date.now())}.png`;
    link.href = objectUrl;
    link.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Prism Composer could not export the canvas as PNG."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}
