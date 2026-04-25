import type { CanvasRuntime } from "@synthesisengineering/prism";

export async function exportRuntimePng(
  runtime: CanvasRuntime,
  filename: string
): Promise<void> {
  // Export stays deliberately boring: wait for font layout, wait for one
  // Prism-owned paint pass, then use the platform canvas PNG API.
  await document.fonts.ready;
  await runtime.paintOnce();
  const blob = await canvasToBlob(runtime.canvas);
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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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
