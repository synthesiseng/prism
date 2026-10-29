import { CanvasRuntime } from "@synthesisengineering/prism";

type Bounds = { x: number; y: number; width: number; height: number };
type PixelBox = { x: number; y: number; width: number; height: number } | null;
let active: ReturnType<typeof create> | undefined;

function create(options: { dynamic: boolean; scale: number; transform: boolean }) {
  const root = document.createElement("div");
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `width:600px;height:350px;transform:scale(${String(options.scale)});transform-origin:0 0`;
  const element = document.createElement("section");
  element.style.cssText = "background:rgb(255,0,0);font:16px/20px monospace;box-sizing:border-box";
  const transform = options.transform ? "translate(6px, 4px)" : "";
  element.style.transform = transform;
  const button = document.createElement("button");
  button.style.cssText = "position:absolute;left:12px;top:8px;width:40px;height:20px;background:rgb(0,0,255);border:0;padding:0;border-radius:0;appearance:none";
  const text = document.createElement("p");
  text.style.cssText = "margin:40px 0 0;padding:0";
  text.textContent = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu ".repeat(3);
  const content = document.createElement("div");
  content.style.display = "flow-root";
  content.append(button, text);
  element.append(content);
  root.append(canvas, element);
  document.body.append(root);
  const naturalWidth = element.offsetWidth;
  const initialWidth = element.style.width, initialHeight = element.style.height;
  let paintEvents = 0;
  canvas.addEventListener("paint", () => { paintEvents++; });
  const runtime = new CanvasRuntime(canvas, { backend: "native" });
  const ctx = canvas.getContext("2d")! as CanvasRenderingContext2D & {
    drawElementImage(element: Element, x: number, y: number, width: number, height: number): void;
  };
  let bounds: Bounds = { x: 40, y: 40, width: 120, height: 240 };
  const surface = runtime.registerSurface(element, { bounds: options.dynamic ? () => bounds : bounds });
  let clicks = 0, passes = 0, insideWidth: number | undefined;
  let atlantic = false;
  let inside: Bounds | undefined;
  button.addEventListener("click", () => { clicks++; });
  const pixels = (): PixelBox => {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 255 && data[i + 3] === 255) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  };
  let captureFirstDraw = false;
  const draws: { width: number; height: number; pixels: PixelBox; pass: number }[] = [];
  const draw = ctx.drawElementImage.bind(ctx);
  ctx.drawElementImage = (...args) => {
    draw(...args);
    if (captureFirstDraw) {
      captureFirstDraw = false;
      draws.push({ width: element.offsetWidth, height: element.offsetHeight, pixels: pixels(), pass: passes });
    }
  };
  runtime.onPaint(({ drawSurface }) => {
    passes++;
    if (inside) {
      bounds = inside; inside = undefined;
      if (!options.dynamic) surface.setBounds(bounds);
      insideWidth = element.offsetWidth;
    }
    if (atlantic) {
      bounds = { ...bounds, width: 280, height: Math.max(content.offsetHeight, 180) };
      if (!options.dynamic) surface.setBounds(bounds);
    }
    drawSurface(surface);
  });
  let capturePaintState = false;
  const paintStates: { pass: number; inert: boolean; pointerEvents: string; focused: boolean }[] = [];
  canvas.addEventListener("paint", () => {
    if (capturePaintState) paintStates.push({ pass: passes, inert: element.inert,
      pointerEvents: element.style.pointerEvents, focused: document.activeElement === button });
  });
  const measure = () => {
    const range = document.createRange(); range.selectNodeContents(text);
    const lines = new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top))).size;
    const rect = canvas.getBoundingClientRect();
    const dx = options.transform ? 6 : 0, dy = options.transform ? 4 : 0;
    return {
      bounds: { ...bounds }, width: element.offsetWidth, height: element.offsetHeight, textHeight: text.offsetHeight, lines,
      pixels: pixels(), bitmapRatio: canvas.width / 600, devicePixelRatio,
      expectedPixelBox: { x: bounds.x + 12 + dx, y: bounds.y + 8 + dy, width: 40, height: 20 },
      clickPoint: { x: rect.left + (bounds.x + 32 + dx) * rect.width / 600, y: rect.top + (bounds.y + 18 + dy) * rect.height / 350 },
      clicks, focused: document.activeElement === button, transformPreserved: element.style.transform === transform, passes, insideWidth, naturalWidth
    };
  };
  return {
    async paint() {
      const before = draws.length, beforePass = passes, beforeState = paintStates.length;
      captureFirstDraw = true; capturePaintState = true;
      try { await runtime.paintOnce(); }
      finally { captureFirstDraw = false; capturePaintState = false; }
      return { ...measure(), firstDraw: draws[before], firstPaint: paintStates[beforeState], beforePass };
    },
    async resize(width: number, duringPaint: boolean) {
      const next = { ...bounds, width, height: Math.max(content.offsetHeight, 180) };
      if (duringPaint) inside = next;
      else { bounds = next; if (!options.dynamic) surface.setBounds(bounds); }
      return this.paint();
    },
    async converge() {
      atlantic = true;
      const samples = [];
      for (let i = 0; i < 4; i++) samples.push(await this.paint());
      return samples;
    },
    async shrink() {
      atlantic = true;
      text.style.margin = "0"; text.style.whiteSpace = "pre";
      text.textContent = Array.from({ length: 35 }, () => "line").join("\n");
      runtime.invalidate();
      const grown = await this.paint();
      const longContent = content.offsetHeight;
      text.textContent = "line";
      runtime.invalidate();
      const shrunk = await this.paint();
      return { grown, shrunk, longContent, shortContent: content.offsetHeight };
    },
    async borderBox() {
      element.style.padding = "10px"; element.style.border = "2px solid red";
      bounds = { ...bounds, width: 120, height: 80 };
      surface.setBounds(bounds); runtime.invalidate();
      const result = await this.paint();
      return { ...result, boxSizing: getComputedStyle(element).boxSizing };
    },
    async idle() {
      // Pixel/layout readback inside paint can itself dirty a subsequent browser frame.
      // Settle one unmeasured pass, then observe raw events without further readback.
      await runtime.paintOnce();
      const before = paintEvents, started = performance.now();
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { paintEvents: paintEvents - before, elapsedMs: performance.now() - started };
    },
    measure,
    dispose(appChanges: boolean) {
      if (appChanges) { element.style.width = "777px"; element.style.height = "88px"; }
      runtime.destroy();
      const result = {
        width: element.style.width === (appChanges ? "777px" : initialWidth),
        height: element.style.height === (appChanges ? "88px" : initialHeight),
        transform: element.style.transform === transform, parent: element.parentElement === root
      };
      root.remove();
      return result;
    }
  };
}

const fixture = {
  setup(options: { dynamic: boolean; scale: number; transform: boolean }) {
    active?.dispose(false); active = create(options);
    return active.paint();
  },
  resize(width: number, duringPaint: boolean) { return active!.resize(width, duringPaint); },
  measure() { return active!.measure(); },
  converge() { return active!.converge(); },
  shrink() { return active!.shrink(); },
  borderBox() { return active!.borderBox(); },
  idle() { return active!.idle(); },
  dispose(appChanges: boolean) { const result = active!.dispose(appChanges); active = undefined; return result; }
};
declare global { interface Window { prismLayoutFixture: typeof fixture; } }
window.prismLayoutFixture = fixture;
