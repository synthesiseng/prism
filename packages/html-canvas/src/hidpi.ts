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

    onResize(resizeCanvasToDisplaySize(canvas, entry));
  });

  try {
    observer.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    observer.observe(canvas);
  }
  return observer;
}

export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  entry?: ResizeObserverEntry
): CanvasMetrics {
  const pixelRatio = globalThis.devicePixelRatio || 1;
  const devicePixelBox = entry
    ? (entry as Partial<Pick<ResizeObserverEntry, "devicePixelContentBoxSize">>)
        .devicePixelContentBoxSize
    : undefined;
  const box = devicePixelBox?.[0];
  const cssWidth = entry?.contentRect.width ?? canvas.clientWidth;
  const cssHeight = entry?.contentRect.height ?? canvas.clientHeight;
  const pixelWidth = Math.max(1, Math.round(box?.inlineSize ?? cssWidth * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(box?.blockSize ?? cssHeight * pixelRatio));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  return { cssWidth, cssHeight, pixelWidth, pixelHeight, pixelRatio };
}
