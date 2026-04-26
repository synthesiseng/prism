import type { CanvasRuntime } from "@synthesisengineering/prism";

export async function exportCanvasPng(
  runtime: CanvasRuntime,
  filename: string
): Promise<void> {
  // Prism owns paint readiness for DOM surfaces. PNG creation stays on the
  // platform canvas API once the runtime has completed a paint pass.
  await document.fonts.ready;
  await runtime.paintOnce();
  const blob = await canvasToPngBlob(runtime.canvas);
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas export did not produce a PNG blob."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
