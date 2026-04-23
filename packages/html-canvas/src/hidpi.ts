export type CanvasMetrics = Readonly<{
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  pixelRatio: number;
}>;

export function observeHiDpiCanvas(
  canvas: HTMLCanvasElement,
  onResize: (metrics: CanvasMetrics) => void
): ResizeObserver {
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }

    const pixelRatio = globalThis.devicePixelRatio || 1;
    const box = entry.devicePixelContentBoxSize[0];
    const pixelWidth = box
      ? box.inlineSize
      : Math.round(entry.contentRect.width * pixelRatio);
    const pixelHeight = box
      ? box.blockSize
      : Math.round(entry.contentRect.height * pixelRatio);
    const cssWidth = pixelWidth / pixelRatio;
    const cssHeight = pixelHeight / pixelRatio;

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    onResize({ cssWidth, cssHeight, pixelWidth, pixelHeight, pixelRatio });
  });

  observer.observe(canvas, { box: "device-pixel-content-box" });
  return observer;
}
