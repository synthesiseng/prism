import { CanvasRuntime, type CanvasSurface } from "@synthesisengineering/prism";

type Slice = Readonly<{
  name: string;
  value: number;
  color: string;
  highlight: string;
}>;

type LabelRecord = Readonly<{
  slice: Slice;
  element: HTMLElement;
  surface: CanvasSurface;
}>;

const slices: readonly Slice[] = [
  {
    name: "Apple",
    value: 0.45,
    color: "#f25f4c",
    highlight: "#ffd0c8"
  },
  {
    name: "Blackberry / Bramble",
    value: 0.35,
    color: "#4f7cff",
    highlight: "#d7e2ff"
  },
  {
    name: "Durian",
    value: 0.2,
    color: "#f6c945",
    highlight: "#fff0a8"
  }
];

const canvas = getCanvasElement("chart");
const labelsRoot = getElement("labels");
const runtime = new CanvasRuntime(canvas, { backend: "auto" });

const labels = slices.map((slice) => {
  const element = document.createElement("div");
  element.className = "label";
  element.role = "listitem";
  element.tabIndex = 0;
  element.append(
    createTextElement("span", "value", formatPercent(slice.value)),
    createTextElement("span", undefined, slice.name)
  );

  // Keep the original parent mounted so Prism can restore DOM ownership.
  labelsRoot.appendChild(element);
  element.addEventListener("focus", () => {
    runtime.invalidate();
  });
  element.addEventListener("blur", () => {
    runtime.invalidate();
  });

  const surface = runtime.registerSurface(element, {
    bounds: { x: 0, y: 0, width: 1, height: 1 }
  });

  return {
    slice,
    element,
    surface
  };
});

runtime.onPaint(({ ctx, drawSurface }) => {
  const width = runtime.width;
  const height = runtime.height;
  if (width === 0 || height === 0) {
    return;
  }

  const centerCss = { x: width / 2, y: height / 2 };
  // Direct canvas drawing uses backing-store pixels, unlike surface bounds.
  const center = runtime.cssPointToCanvasPixels(centerCss);
  const radiusCss = Math.min(width, height) * 0.42;
  const radius = runtime.cssLengthToCanvasPixels(radiusCss);
  const chartPadding = runtime.cssLengthToCanvasPixels(8);
  const sliceStrokeWidth = runtime.cssLengthToCanvasPixels(3);
  let angle = -Math.PI / 2;
  let focusedPath: Path2D | undefined;
  let focusedElement: HTMLElement | undefined;

  drawChartBackground(ctx, center.x, center.y, radius, chartPadding);

  for (const record of labels) {
    const sliceAngle = record.slice.value * Math.PI * 2;
    const path = drawSlice(
      ctx,
      center.x,
      center.y,
      radius,
      angle,
      angle + sliceAngle,
      record.slice,
      sliceStrokeWidth
    );

    if (document.activeElement === record.element) {
      focusedPath = path;
      focusedElement = record.element;
    }

    const midpoint = angle + sliceAngle / 2;
    positionLabel(record, centerCss, radiusCss, midpoint);
    drawSurface(record.surface);
    angle += sliceAngle;
  }

  // Draw the browser focus ring after the HTML surfaces so it stays on top.
  if (focusedPath && focusedElement) {
    ctx.drawFocusIfNeeded(focusedPath, focusedElement);
  }
});

runtime.start();

function drawChartBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  padding: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius + padding, 0, Math.PI * 2);
  ctx.fillStyle = "#f8fafc";
  ctx.fill();
  ctx.restore();
}

function drawSlice(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  start: number,
  end: number,
  slice: Slice,
  strokeWidth: number
): Path2D {
  const path = new Path2D();
  path.moveTo(x, y);
  path.arc(x, y, radius, start, end);
  path.closePath();

  const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, slice.highlight);
  gradient.addColorStop(1, slice.color);

  ctx.fillStyle = gradient;
  ctx.fill(path);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = strokeWidth;
  ctx.stroke(path);

  return path;
}

function positionLabel(
  record: LabelRecord,
  center: Readonly<{ x: number; y: number }>,
  radius: number,
  angle: number
): void {
  const width = Math.max(record.element.offsetWidth, 1);
  const height = Math.max(record.element.offsetHeight, 1);

  // Surface bounds are CSS pixels; Prism converts them during drawSurface().
  record.surface.setBounds({
    x: center.x + Math.cos(angle) * radius * 0.6 - width / 2,
    y: center.y + Math.sin(angle) * radius * 0.6 - height / 2,
    width,
    height
  });
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element;
}

function getCanvasElement(id: string): HTMLCanvasElement {
  const element = getElement(id);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`#${id} must be a canvas element.`);
  }
  return element;
}

function createTextElement(
  tagName: string,
  className: string | undefined,
  text: string
): HTMLElement {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function formatPercent(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}
