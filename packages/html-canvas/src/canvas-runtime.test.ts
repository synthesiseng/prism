import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { CanvasRuntime } from "./canvas-runtime";

class FakeDomMatrix {
  private x = 0;
  private y = 0;

  translateSelf(x: number, y: number): this {
    this.x += x;
    this.y += y;
    return this;
  }

  toString(): string {
    return `matrix(1, 0, 0, 1, ${String(this.x)}, ${String(this.y)})`;
  }
}

class FakeResizeObserver {
  static readonly instances: FakeResizeObserver[] = [];

  static reset(): void {
    FakeResizeObserver.instances.length = 0;
  }

  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(entry: Partial<ResizeObserverEntry>): void {
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

class ManualRaf {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextHandle = 1;

  request = (callback: FrameRequestCallback): number => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  };

  cancel = (handle: number): void => {
    this.callbacks.delete(handle);
  };

  get pendingCount(): number {
    return this.callbacks.size;
  }

  step(nowMs = 16): void {
    const [handle, callback] = this.callbacks.entries().next().value ?? [];
    if (handle === undefined || callback === undefined) {
      throw new Error("Expected a pending frame callback.");
    }

    this.callbacks.delete(handle);
    callback(nowMs);
  }
}

class FakeStyle {
  position = "";
  left = "";
  top = "";
  width = "";
  height = "";
  transform = "";
  transformOrigin = "";
  pointerEvents = "";
  private readonly customProperties = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.customProperties.set(name, value);
  }
}

class FakeElement extends EventTarget {
  readonly paintListeners = new Set<EventListenerOrEventListenerObject>();
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
  ): void {
    super.addEventListener(type, callback, options);
    if (type === "paint" && callback) this.paintListeners.add(callback);
  }
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ): void {
    super.removeEventListener(type, callback, options);
    if (type === "paint" && callback) this.paintListeners.delete(callback);
  }

  readonly style = new FakeStyle();
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  ownerDocument!: FakeDocument;
  parentNode: FakeElement | null = null;
  parentElement: FakeElement | null = null;
  inert = false;

  constructor(readonly tagName: string) {
    super();
  }

  get nextSibling(): FakeElement | null {
    if (!this.parentNode) {
      return null;
    }

    const index = this.parentNode.children.indexOf(this);
    return index === -1 ? null : (this.parentNode.children[index + 1] ?? null);
  }

  appendChild<TElement extends FakeElement>(element: TElement): TElement {
    element.remove();
    this.children.push(element);
    element.parentNode = this;
    element.parentElement = this;
    element.ownerDocument = this.ownerDocument;
    return element;
  }

  insertBefore<TElement extends FakeElement>(
    element: TElement,
    nextSibling: FakeElement | null
  ): TElement {
    element.remove();
    const index = nextSibling ? this.children.indexOf(nextSibling) : -1;
    if (index === -1) {
      this.children.push(element);
    } else {
      this.children.splice(index, 0, element);
    }
    element.parentNode = this;
    element.parentElement = this;
    element.ownerDocument = this.ownerDocument;
    return element;
  }

  remove(): void {
    if (!this.parentNode) {
      return;
    }

    const siblings = this.parentNode.children;
    const index = siblings.indexOf(this);
    if (index !== -1) {
      siblings.splice(index, 1);
    }
    this.parentNode = null;
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "data-prism-surface") {
      this.dataset.prismSurface = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === "data-prism-surface") {
      delete this.dataset.prismSurface;
    }
  }
}

class FakeCanvasContext {
  drawImageCount = 0;
  readonly drawImageCalls: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  readonly drawElementImageCalls: Array<{
    element: FakeElement;
    x: number;
    y: number;
    width: number | undefined;
    height: number | undefined;
  }> = [];
  clearCount = 0;
  drawElementImage?: (
    element: FakeElement,
    x: number,
    y: number,
    width?: number,
    height?: number
  ) => DOMMatrix | null;

  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  font = "";

  constructor(native = false) {
    if (native) {
      this.drawElementImage = (element, x, y, width, height) => {
        this.drawElementImageCalls.push({ element, x, y, width, height });
        return new FakeDomMatrix().translateSelf(12, 18) as unknown as DOMMatrix;
      };
    }
  }

  reset(): void {}

  clearRect(): void {
    this.clearCount += 1;
  }

  drawImage(_source: unknown, x = 0, y = 0, width = 0, height = 0): void {
    this.drawImageCount += 1;
    this.drawImageCalls.push({ x, y, width, height });
  }

  fillRect(): void {}
  strokeRect(): void {}
  fillText(): void {}
  scale(): void {}
}

class FakeCanvas extends FakeElement {
  content = "fallback";
  width = 0;
  height = 0;
  clientWidth = 300;
  clientHeight = 150;
  onpaint: ((this: HTMLCanvasElement, event: Event) => void) | null = null;
  requestPaint?: () => void;
  requestPaintCount = 0;

  readonly context: FakeCanvasContext;

  constructor(private readonly native = false) {
    super("CANVAS");
    this.context = new FakeCanvasContext(native);
    if (native) {
      this.requestPaint = () => {
        this.requestPaintCount += 1;
      };
    }
  }

  getContext(kind: string): FakeCanvasContext | null {
    return kind === "2d" ? this.context : null;
  }

  getBoundingClientRect(): DOMRect {
    return {
      left: 10,
      top: 20,
      width: this.clientWidth,
      height: this.clientHeight,
      right: 10 + this.clientWidth,
      bottom: 20 + this.clientHeight,
      x: 10,
      y: 20,
      toJSON: () => ({})
    };
  }
}

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  readonly visibilityListeners = new Set<EventListenerOrEventListenerObject>();
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
  ): void {
    super.addEventListener(type, callback, options);
    if (type === "visibilitychange" && callback) this.visibilityListeners.add(callback);
  }
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ): void {
    super.removeEventListener(type, callback, options);
    if (type === "visibilitychange" && callback)
      this.visibilityListeners.delete(callback);
  }
  setVisibility(value: DocumentVisibilityState): void {
    this.visibilityState = value;
    this.dispatchEvent(new Event("visibilitychange"));
  }

  createElement(tagName: string): FakeElement {
    const element =
      tagName.toLowerCase() === "canvas"
        ? new FakeCanvas(false)
        : new FakeElement(tagName.toUpperCase());
    element.ownerDocument = this;
    return element;
  }

  createComment(): FakeElement {
    const element = new FakeElement("#comment");
    element.ownerDocument = this;
    return element;
  }
}

function emitPaint(canvas: FakeCanvas): void {
  canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, new Event("paint"));
  canvas.dispatchEvent(new Event("paint"));
}

type RuntimeInternals = {
  flushPaint(): void;
};

function currentResizeObserver(): FakeResizeObserver {
  const observer = FakeResizeObserver.instances.at(-1);
  if (!observer) {
    throw new Error("Expected CanvasRuntime to create a ResizeObserver.");
  }
  return observer;
}

function resizeEntry(width: number, height: number): Partial<ResizeObserverEntry> {
  return {
    contentRect: { width, height } as DOMRectReadOnly
  };
}

describe("CanvasRuntime", () => {
  let document: FakeDocument;

  beforeEach(() => {
    document = new FakeDocument();
    FakeResizeObserver.reset();
    vi.stubGlobal("devicePixelRatio", 2);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.stubGlobal("DOMMatrix", FakeDomMatrix);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("backend selection", () => {
    it("prefers the native HTML-in-Canvas backend when available", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      expect(runtime.backendKind).toBe("native");
      expect(canvas.getAttribute("content")).toBe("drawable");

      canvas.requestPaintCount = 0;
      runtime.invalidate();

      expect(canvas.requestPaintCount).toBe(1);
      runtime.destroy();
    });
  });

  describe("surface bounds", () => {
    it("draws surfaces in runtime-owned CSS coordinates and activates only drawn surfaces", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 20, y: 30, width: 100, height: 50 }
      });

      expect(runtime.backendKind).toBe("fallback");

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(surface);
      });

      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(element.style.width).toBe("100px");
      expect(element.style.height).toBe("50px");
      expect(element.style.pointerEvents).toBe("auto");
      expect(element.inert).toBe(false);
      expect(canvas.context.drawImageCount).toBe(1);

      runtime.destroy();
    });

    it("updates surface bounds through the surface API", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 20, y: 30, width: 100, height: 50 }
      });

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(surface);
      });

      surface.setBounds({ x: 40, y: 45, width: 120, height: 60 });
      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(surface.getBounds()).toEqual({
        x: 40,
        y: 45,
        width: 120,
        height: 60
      });
      expect(element.style.width).toBe("120px");
      expect(element.style.height).toBe("60px");
      expect(element.style.transform).toBe("matrix(1, 0, 0, 1, 40, 45)");

      runtime.destroy();
    });

    it("rejects duplicate registration within one runtime", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 1, y: 2, width: 30, height: 40 }
      });
      try {
        expect(() =>
          runtime.registerSurface(element as unknown as HTMLElement, {
            bounds: { x: 10, y: 20, width: 300, height: 400 }
          })
        ).toThrow(/already.*own/i);
        expect(surface.getBounds()).toEqual({ x: 1, y: 2, width: 30, height: 40 });
      } finally {
        runtime.destroy();
      }
    });

    it("requests native paint when bounds update outside paint", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 10, height: 10 }
      });

      canvas.requestPaintCount = 0;
      surface.setBounds({ x: 10, y: 20, width: 30, height: 40 });

      expect(canvas.requestPaintCount).toBe(0);

      runtime.destroy();
    });

    it("paints multiple surfaces after bounds updates", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const firstElement = document.createElement("section");
      const secondElement = document.createElement("aside");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const firstSurface = runtime.registerSurface(
        firstElement as unknown as HTMLElement,
        {
          bounds: { x: 0, y: 0, width: 10, height: 10 }
        }
      );
      const secondSurface = runtime.registerSurface(
        secondElement as unknown as HTMLElement,
        {
          bounds: { x: 20, y: 20, width: 20, height: 20 }
        }
      );

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(firstSurface);
        drawSurface(secondSurface);
      });

      firstSurface.setBounds({ x: 5, y: 6, width: 30, height: 40 });
      secondSurface.setBounds({ x: 50, y: 60, width: 70, height: 80 });
      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(canvas.context.drawImageCount).toBe(2);
      expect(firstElement.style.width).toBe("30px");
      expect(firstElement.style.height).toBe("40px");
      expect(firstElement.style.transform).toBe("matrix(1, 0, 0, 1, 5, 6)");
      expect(secondElement.style.width).toBe("70px");
      expect(secondElement.style.height).toBe("80px");
      expect(secondElement.style.transform).toBe("matrix(1, 0, 0, 1, 50, 60)");

      runtime.destroy();
    });

    it("keeps setBounds in CSS pixels while drawing in backing-store pixels", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 10, height: 10 }
      });

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(surface);
      });

      surface.setBounds({ x: 10, y: 15, width: 25, height: 30 });
      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(element.style.width).toBe("25px");
      expect(element.style.height).toBe("30px");
      expect(element.style.transform).toBe("matrix(1, 0, 0, 1, 10, 15)");
      expect(canvas.context.drawImageCalls).toEqual([
        { x: 20, y: 30, width: 50, height: 60 }
      ]);

      runtime.destroy();
    });

    it("does not request a redundant native paint when bounds update during paint", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 10, height: 10 }
      });

      runtime.onPaint(({ drawSurface }) => {
        surface.setBounds({ x: 10, y: 20, width: 30, height: 40 });
        drawSurface(surface);
      });

      canvas.requestPaintCount = 0;
      emitPaint(canvas);

      expect(canvas.requestPaintCount).toBe(0);
      expect(canvas.context.drawElementImageCalls.at(-1)).toMatchObject({
        x: 20,
        y: 40,
        width: 60,
        height: 80
      });
      expect(element.style.transform).toBe("");

      runtime.destroy();
    });
  });

  describe("resize and DPR", () => {
    it("updates runtime dimensions and backing store when display metrics change", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      canvas.clientWidth = 320;
      canvas.clientHeight = 180;

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      expect(runtime.width).toBe(320);
      expect(runtime.height).toBe(180);
      expect(runtime.pixelRatio).toBe(2);
      expect(canvas.width).toBe(640);
      expect(canvas.height).toBe(360);

      vi.stubGlobal("devicePixelRatio", 3);
      canvas.clientWidth = 400;
      canvas.clientHeight = 250;
      currentResizeObserver().trigger(resizeEntry(400, 250));

      expect(runtime.width).toBe(400);
      expect(runtime.height).toBe(250);
      expect(runtime.pixelRatio).toBe(3);
      expect(canvas.width).toBe(1200);
      expect(canvas.height).toBe(750);
      expect(runtime.cssLengthToCanvasPixels(10)).toBe(30);
      expect(runtime.cssPointToCanvasPixels({ x: 12, y: 8 })).toEqual({
        x: 36,
        y: 24
      });

      runtime.destroy();
    });

    it("keeps client coordinate conversion in CSS space after resize and DPR changes", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      canvas.clientWidth = 300;
      canvas.clientHeight = 150;

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      expect(runtime.clientToCanvasPoint(210, 170)).toEqual({ x: 200, y: 150 });

      vi.stubGlobal("devicePixelRatio", 4);
      canvas.clientWidth = 600;
      canvas.clientHeight = 300;
      currentResizeObserver().trigger(resizeEntry(600, 300));

      expect(runtime.width).toBe(600);
      expect(runtime.height).toBe(300);
      expect(runtime.pixelRatio).toBe(4);
      expect(runtime.clientToCanvasPoint(210, 170)).toEqual({ x: 200, y: 150 });

      runtime.destroy();
    });

    it("keeps surface alignment in backing-store pixels after resize and DPR changes", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 10, y: 15, width: 20, height: 25 }
      });

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(surface);
      });

      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(canvas.context.drawImageCalls.at(-1)).toEqual({
        x: 20,
        y: 30,
        width: 40,
        height: 50
      });

      vi.stubGlobal("devicePixelRatio", 3);
      canvas.clientWidth = 600;
      canvas.clientHeight = 300;
      currentResizeObserver().trigger(resizeEntry(600, 300));
      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(canvas.context.drawImageCalls.at(-1)).toEqual({
        x: 30,
        y: 45,
        width: 60,
        height: 75
      });
      expect(element.style.width).toBe("20px");
      expect(element.style.height).toBe("25px");
      expect(element.style.transform).toBe("matrix(1, 0, 0, 1, 10, 15)");

      runtime.destroy();
    });

    it("requests native paint when resize updates native runtime metrics", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      canvas.requestPaintCount = 0;
      canvas.clientWidth = 500;
      canvas.clientHeight = 240;
      currentResizeObserver().trigger(resizeEntry(500, 240));

      expect(runtime.width).toBe(500);
      expect(runtime.height).toBe(240);
      expect(canvas.width).toBe(1000);
      expect(canvas.height).toBe(480);
      expect(canvas.requestPaintCount).toBe(1);

      runtime.destroy();
    });
  });

  describe("multiple surfaces", () => {
    it("draws multiple surfaces in one paint pass", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const firstElement = document.createElement("section");
      const secondElement = document.createElement("aside");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const firstSurface = runtime.registerSurface(
        firstElement as unknown as HTMLElement,
        {
          bounds: { x: 10, y: 20, width: 30, height: 40 }
        }
      );
      const secondSurface = runtime.registerSurface(
        secondElement as unknown as HTMLElement,
        {
          bounds: { x: 50, y: 60, width: 70, height: 80 }
        }
      );

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(firstSurface);
        drawSurface(secondSurface);
      });

      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(canvas.context.drawImageCount).toBe(2);
      expect(canvas.context.drawImageCalls).toEqual([
        { x: 20, y: 40, width: 60, height: 80 },
        { x: 100, y: 120, width: 140, height: 160 }
      ]);
      expect(firstElement.style.pointerEvents).toBe("auto");
      expect(secondElement.style.pointerEvents).toBe("auto");

      runtime.destroy();
    });

    it("preserves caller draw order for native surfaces", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const firstElement = document.createElement("section");
      const secondElement = document.createElement("aside");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const firstSurface = runtime.registerSurface(
        firstElement as unknown as HTMLElement,
        {
          bounds: { x: 10, y: 20, width: 30, height: 40 }
        }
      );
      const secondSurface = runtime.registerSurface(
        secondElement as unknown as HTMLElement,
        {
          bounds: { x: 50, y: 60, width: 70, height: 80 }
        }
      );

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(secondSurface);
        drawSurface(firstSurface);
      });

      emitPaint(canvas);

      expect(canvas.context.drawElementImageCalls).toEqual([
        {
          element: secondElement,
          x: 100,
          y: 120,
          width: 140,
          height: 160
        },
        {
          element: firstElement,
          x: 20,
          y: 40,
          width: 60,
          height: 80
        }
      ]);

      runtime.destroy();
    });

    it("preserves source transform when native drawElementImage returns no transform", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      canvas.context.drawElementImage = (element, x, y, width, height) => {
        canvas.context.drawElementImageCalls.push({ element, x, y, width, height });
        return null;
      };
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 10, y: 20, width: 30, height: 40 }
      });

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(surface);
      });

      emitPaint(canvas);

      expect(element.style.transform).toBe("");

      runtime.destroy();
    });

    it("deactivates skipped surfaces and reactivates them when drawn later", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const firstElement = document.createElement("section");
      const secondElement = document.createElement("aside");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const firstSurface = runtime.registerSurface(
        firstElement as unknown as HTMLElement,
        {
          bounds: { x: 0, y: 0, width: 100, height: 50 }
        }
      );
      const secondSurface = runtime.registerSurface(
        secondElement as unknown as HTMLElement,
        {
          bounds: { x: 120, y: 0, width: 100, height: 50 }
        }
      );
      let paintFirst = true;

      runtime.onPaint(({ drawSurface }) => {
        if (paintFirst) {
          drawSurface(firstSurface);
          return;
        }

        drawSurface(secondSurface);
      });

      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(firstElement.style.pointerEvents).toBe("auto");
      expect(firstElement.inert).toBe(false);
      expect(secondElement.style.pointerEvents).toBe("none");
      expect(secondElement.inert).toBe(true);

      paintFirst = false;
      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(firstElement.style.pointerEvents).toBe("none");
      expect(firstElement.inert).toBe(true);
      expect(secondElement.style.pointerEvents).toBe("auto");
      expect(secondElement.inert).toBe(false);

      runtime.destroy();
    });

    it("keeps focus interactivity isolated across multiple surfaces", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const focusedElement = document.createElement("section");
      const idleElement = document.createElement("aside");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const focusedSurface = runtime.registerSurface(
        focusedElement as unknown as HTMLElement,
        {
          bounds: { x: 0, y: 0, width: 100, height: 50 }
        }
      );

      runtime.registerSurface(idleElement as unknown as HTMLElement, {
        bounds: { x: 120, y: 0, width: 100, height: 50 }
      });
      runtime.onPaint(({ drawSurface }) => {
        drawSurface(focusedSurface);
      });

      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(focusedElement.style.pointerEvents).toBe("auto");
      expect(focusedElement.inert).toBe(false);
      expect(idleElement.style.pointerEvents).toBe("none");
      expect(idleElement.inert).toBe(true);

      runtime.invalidate();
      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(focusedElement.style.pointerEvents).toBe("auto");
      expect(focusedElement.inert).toBe(false);
      expect(idleElement.style.pointerEvents).toBe("none");
      expect(idleElement.inert).toBe(true);

      runtime.destroy();
    });
  });

  describe("paintOnce", () => {
    it("resolves paintOnce after a fallback paint pass without starting the frame loop", async () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 20, y: 30, width: 100, height: 50 }
      });
      let paintCount = 0;

      runtime.onPaint(({ drawSurface }) => {
        paintCount += 1;
        drawSurface(surface);
      });

      expect(paintCount).toBe(0);

      await runtime.paintOnce();

      expect(paintCount).toBe(1);
      expect(canvas.context.drawImageCount).toBe(1);
      expect(element.style.pointerEvents).toBe("auto");

      runtime.destroy();
    });

    it("resolves concurrent paintOnce calls from the same fallback paint pass", async () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      let paintCount = 0;

      runtime.onPaint(() => {
        paintCount += 1;
      });

      const firstPaint = runtime.paintOnce();
      const secondPaint = runtime.paintOnce();

      expect(paintCount).toBe(0);

      await Promise.all([firstPaint, secondPaint]);

      expect(paintCount).toBe(1);

      runtime.destroy();
    });

    it("resolves paintOnce after the native paint event is flushed", async () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 20, y: 30, width: 100, height: 50 }
      });
      let resolved = false;

      runtime.onPaint(({ drawSurface }) => {
        drawSurface(surface);
      });

      canvas.requestPaintCount = 0;
      const paint = runtime.paintOnce().then(() => {
        resolved = true;
      });

      await Promise.resolve();

      expect(canvas.requestPaintCount).toBe(0);
      expect(resolved).toBe(false);

      emitPaint(canvas);
      await paint;

      expect(resolved).toBe(true);
      expect(element.style.pointerEvents).toBe("auto");

      runtime.destroy();
    });

    it("resolves concurrent native paintOnce calls from the same browser paint event", async () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      let paintCount = 0;
      let firstResolved = false;
      let secondResolved = false;

      runtime.onPaint(() => {
        paintCount += 1;
      });

      canvas.requestPaintCount = 0;
      const firstPaint = runtime.paintOnce().then(() => {
        firstResolved = true;
      });
      const secondPaint = runtime.paintOnce().then(() => {
        secondResolved = true;
      });

      await Promise.resolve();

      expect(canvas.requestPaintCount).toBe(0);
      expect(firstResolved).toBe(false);
      expect(secondResolved).toBe(false);

      emitPaint(canvas);
      await Promise.all([firstPaint, secondPaint]);

      expect(paintCount).toBe(1);
      expect(firstResolved).toBe(true);
      expect(secondResolved).toBe(true);

      runtime.destroy();
    });

    it("resolves native paintOnce called inside onPaint from the next browser paint event", async () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      let paintCount = 0;
      const nestedPaints: Array<Promise<void>> = [];
      let nestedResolvedAtPaintCount = 0;

      runtime.onPaint(() => {
        paintCount += 1;
        if (nestedPaints.length === 0) {
          nestedPaints.push(
            runtime.paintOnce().then(() => {
              nestedResolvedAtPaintCount = paintCount;
            })
          );
        }
      });

      canvas.requestPaintCount = 0;
      const firstPaint = runtime.paintOnce();
      emitPaint(canvas);
      await firstPaint;

      expect(nestedPaints).toHaveLength(1);
      expect(canvas.requestPaintCount).toBe(1);
      expect(nestedResolvedAtPaintCount).toBe(0);

      emitPaint(canvas);
      await Promise.all(nestedPaints);

      expect(paintCount).toBe(2);
      expect(nestedResolvedAtPaintCount).toBe(2);

      runtime.destroy();
    });

    it("resolves paintOnce called inside onPaint from the next fallback paint pass", async () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      let paintCount = 0;
      const nestedPaints: Array<Promise<void>> = [];
      let nestedResolvedAtPaintCount = 0;

      runtime.onPaint(() => {
        paintCount += 1;
        if (nestedPaints.length === 0) {
          nestedPaints.push(
            runtime.paintOnce().then(() => {
              nestedResolvedAtPaintCount = paintCount;
            })
          );
        }
      });

      await runtime.paintOnce();

      expect(nestedPaints).toHaveLength(1);
      await Promise.all(nestedPaints);

      expect(paintCount).toBe(2);
      expect(nestedResolvedAtPaintCount).toBe(2);

      runtime.destroy();
    });

    it("rejects pending paintOnce work when the runtime is destroyed", async () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      const paint = runtime.paintOnce();
      runtime.destroy();

      await expect(paint).rejects.toThrow(
        "Cannot complete paintOnce() after Prism CanvasRuntime is destroyed."
      );
    });

    it("rejects paintOnce waiters with paint handler errors", async () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      runtime.onPaint(() => {
        throw new Error("paint failed");
      });

      await expect(runtime.paintOnce()).rejects.toThrow("paint failed");
      expect(() => {
        (runtime as unknown as RuntimeInternals).flushPaint();
      }).toThrow("paint failed");

      runtime.destroy();
    });

    it("rejects native paintOnce waiters with paint handler errors", async () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      runtime.onPaint(() => {
        throw new Error("native paint failed");
      });

      const paint = runtime.paintOnce();
      const rejected = expect(paint).rejects.toThrow("native paint failed");

      emitPaint(canvas);
      await rejected;

      runtime.destroy();
    });
  });

  describe("surface lifecycle", () => {
    it("keeps undrawn surfaces inactive", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 100, height: 50 }
      });
      runtime.onPaint(() => {});

      (runtime as unknown as RuntimeInternals).flushPaint();

      expect(element.style.pointerEvents).toBe("none");
      expect(element.inert).toBe(true);

      runtime.destroy();
    });

    it("restores DOM ownership and attributes when a surface is disposed", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const parent = document.createElement("div");
      const element = document.createElement("section");
      const sibling = document.createElement("aside");
      parent.appendChild(element);
      parent.appendChild(sibling);
      element.setAttribute("style", "color: red;");
      element.setAttribute("aria-label", "Original label");
      element.setAttribute("data-prism-surface", "old-value");
      element.inert = true;

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 100, height: 50 },
        ariaLabel: "Runtime label"
      });

      expect(element.parentElement).toBe(canvas);
      expect(element.getAttribute("aria-label")).toBe("Runtime label");

      surface.dispose();

      expect(surface.isDisposed).toBe(true);
      expect(parent.children).toEqual([element, sibling]);
      expect(element.getAttribute("style")).toBe("color: red;");
      expect(element.getAttribute("aria-label")).toBe("Original label");
      expect(element.getAttribute("data-prism-surface")).toBe("old-value");
      expect(element.inert).toBe(true);

      runtime.destroy();
    });

    it("restores multiple surfaces independently across unregister and destroy", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const firstParent = document.createElement("div");
      const secondParent = document.createElement("main");
      const firstElement = document.createElement("section");
      const firstSibling = document.createElement("aside");
      const secondSibling = document.createElement("header");
      const secondElement = document.createElement("article");
      firstParent.appendChild(firstElement);
      firstParent.appendChild(firstSibling);
      secondParent.appendChild(secondSibling);
      secondParent.appendChild(secondElement);
      firstElement.setAttribute("style", "color: red;");
      secondElement.setAttribute("style", "color: blue;");

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const firstSurface = runtime.registerSurface(
        firstElement as unknown as HTMLElement,
        {
          bounds: { x: 0, y: 0, width: 100, height: 50 }
        }
      );
      const secondSurface = runtime.registerSurface(
        secondElement as unknown as HTMLElement,
        {
          bounds: { x: 120, y: 0, width: 100, height: 50 }
        }
      );

      expect(firstElement.parentElement).toBe(canvas);
      expect(secondElement.parentElement).toBe(canvas);

      runtime.unregisterSurface(firstSurface);

      expect(firstSurface.isDisposed).toBe(true);
      expect(secondSurface.isDisposed).toBe(false);
      expect(firstParent.children).toEqual([firstElement, firstSibling]);
      expect(firstElement.getAttribute("style")).toBe("color: red;");
      expect(secondElement.parentElement).toBe(canvas);

      runtime.destroy();

      expect(secondSurface.isDisposed).toBe(true);
      expect(secondParent.children).toEqual([secondSibling, secondElement]);
      expect(secondElement.getAttribute("style")).toBe("color: blue;");
    });

    it("does not let one surface disposal corrupt another surface restore path", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const parent = document.createElement("div");
      const firstElement = document.createElement("section");
      const secondElement = document.createElement("article");
      const sibling = document.createElement("aside");
      parent.appendChild(firstElement);
      parent.appendChild(secondElement);
      parent.appendChild(sibling);

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const firstSurface = runtime.registerSurface(
        firstElement as unknown as HTMLElement,
        {
          bounds: { x: 0, y: 0, width: 100, height: 50 }
        }
      );
      const secondSurface = runtime.registerSurface(
        secondElement as unknown as HTMLElement,
        {
          bounds: { x: 120, y: 0, width: 100, height: 50 }
        }
      );

      firstSurface.dispose();
      secondSurface.dispose();

      expect(parent.children).toEqual([firstElement, secondElement, sibling]);

      runtime.destroy();
    });

    it("restores multiple registered surfaces in original order on destroy", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const parent = document.createElement("div");
      const firstElement = document.createElement("section");
      const secondElement = document.createElement("article");
      const thirdElement = document.createElement("nav");
      const sibling = document.createElement("aside");
      parent.appendChild(firstElement);
      parent.appendChild(secondElement);
      parent.appendChild(thirdElement);
      parent.appendChild(sibling);

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const firstSurface = runtime.registerSurface(
        firstElement as unknown as HTMLElement,
        {
          bounds: { x: 0, y: 0, width: 100, height: 50 }
        }
      );
      const secondSurface = runtime.registerSurface(
        secondElement as unknown as HTMLElement,
        {
          bounds: { x: 120, y: 0, width: 100, height: 50 }
        }
      );
      const thirdSurface = runtime.registerSurface(
        thirdElement as unknown as HTMLElement,
        {
          bounds: { x: 240, y: 0, width: 100, height: 50 }
        }
      );

      runtime.destroy();

      expect(firstSurface.isDisposed).toBe(true);
      expect(secondSurface.isDisposed).toBe(true);
      expect(thirdSurface.isDisposed).toBe(true);
      expect(parent.children).toEqual([
        firstElement,
        secondElement,
        thirdElement,
        sibling
      ]);
    });

    it("supports unregistering and re-registering the same element", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const parent = document.createElement("div");
      const element = document.createElement("section");
      const sibling = document.createElement("aside");
      parent.appendChild(element);
      parent.appendChild(sibling);

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const firstSurface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 100, height: 50 }
      });

      runtime.unregisterSurface(firstSurface);

      expect(firstSurface.isDisposed).toBe(true);
      expect(parent.children).toEqual([element, sibling]);

      const secondSurface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 20, y: 30, width: 120, height: 60 }
      });

      expect(secondSurface).not.toBe(firstSurface);
      expect(secondSurface.getBounds()).toEqual({
        x: 20,
        y: 30,
        width: 120,
        height: 60
      });
      expect(element.parentElement).toBe(canvas);

      runtime.destroy();

      expect(secondSurface.isDisposed).toBe(true);
      expect(parent.children).toEqual([element, sibling]);
    });

    it("restores a surface around external DOM mutations near its placeholder", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const parent = document.createElement("div");
      const before = document.createElement("header");
      const element = document.createElement("section");
      const after = document.createElement("footer");
      parent.appendChild(before);
      parent.appendChild(element);
      parent.appendChild(after);

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 100, height: 50 }
      });
      const insertedBeforeSlot = document.createElement("nav");
      const insertedAfterSlot = document.createElement("aside");
      const restoreSlot = parent.children[1] ?? null;
      parent.insertBefore(insertedBeforeSlot, restoreSlot);
      parent.insertBefore(insertedAfterSlot, after);

      runtime.unregisterSurface(surface);

      expect(parent.children).toHaveLength(5);
      expect(parent.children[0]).toBe(before);
      expect(parent.children[1]).toBe(insertedBeforeSlot);
      expect(parent.children[2]).toBe(element);
      expect(parent.children[3]).toBe(insertedAfterSlot);
      expect(parent.children[4]).toBe(after);

      runtime.destroy();
    });
  });

  describe("runtime ownership", () => {
    it("does not let one runtime unregister a surface owned by another runtime", () => {
      const firstCanvas = new FakeCanvas(false);
      const secondCanvas = new FakeCanvas(false);
      firstCanvas.ownerDocument = document;
      secondCanvas.ownerDocument = document;
      const parent = document.createElement("div");
      const element = document.createElement("section");
      parent.appendChild(element);
      const firstRuntime = new CanvasRuntime(firstCanvas as unknown as HTMLCanvasElement);
      const secondRuntime = new CanvasRuntime(
        secondCanvas as unknown as HTMLCanvasElement
      );
      const surface = secondRuntime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 100, height: 50 }
      });

      expect(() => {
        firstRuntime.unregisterSurface(surface);
      }).toThrow(
        "Prism CanvasRuntime can only use surfaces registered with this runtime."
      );

      expect(surface.isDisposed).toBe(false);
      expect(element.parentElement).toBe(secondCanvas);

      secondRuntime.unregisterSurface(surface);

      expect(surface.isDisposed).toBe(true);
      expect(parent.children).toEqual([element]);

      firstRuntime.destroy();
      secondRuntime.destroy();
    });

    it("does not let one runtime draw a surface owned by another runtime", () => {
      const firstCanvas = new FakeCanvas(false);
      const secondCanvas = new FakeCanvas(false);
      firstCanvas.ownerDocument = document;
      secondCanvas.ownerDocument = document;
      const element = document.createElement("section");
      const firstRuntime = new CanvasRuntime(firstCanvas as unknown as HTMLCanvasElement);
      const secondRuntime = new CanvasRuntime(
        secondCanvas as unknown as HTMLCanvasElement
      );
      const surface = secondRuntime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 100, height: 50 }
      });

      firstRuntime.onPaint(({ drawSurface }) => {
        drawSurface(surface);
      });

      expect(() => {
        (firstRuntime as unknown as RuntimeInternals).flushPaint();
      }).toThrow(
        "Prism CanvasRuntime can only use surfaces registered with this runtime."
      );

      expect(surface.isDisposed).toBe(false);
      expect(element.parentElement).toBe(secondCanvas);

      firstRuntime.destroy();
      secondRuntime.destroy();
    });
  });

  describe("coordinates", () => {
    it("centralizes client and backing-store coordinate conversion", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      canvas.clientWidth = 400;
      canvas.clientHeight = 300;

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      expect(runtime.width).toBe(400);
      expect(runtime.height).toBe(300);
      expect(runtime.clientToCanvasPoint(210, 170)).toEqual({ x: 200, y: 150 });
      expect(runtime.cssLengthToCanvasPixels(10)).toBe(20);
      expect(runtime.cssPointToCanvasPixels({ x: 12, y: 8 })).toEqual({
        x: 24,
        y: 16
      });

      runtime.destroy();
    });
  });

  describe("destroy", () => {
    it("cleans up registered surfaces and native paint hooks when destroyed", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const parent = document.createElement("div");
      const element = document.createElement("section");
      parent.appendChild(element);

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 100, height: 50 }
      });

      expect(canvas.paintListeners.size).toBe(1);
      expect(canvas.getAttribute("content")).toBe("drawable");
      expect(element.parentElement).toBe(canvas);

      runtime.destroy();

      expect(canvas.paintListeners.size).toBe(0);
      expect(canvas.getAttribute("content")).toBeNull();
      expect(surface.isDisposed).toBe(true);
      expect(parent.children).toEqual([element]);
      expect(element.getAttribute("style")).toBeNull();
    });

    it("preserves app-authored layoutsubtree state when destroyed", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      canvas.setAttribute("layoutsubtree", "app-owned");

      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      runtime.destroy();

      expect(canvas.getAttribute("layoutsubtree")).toBe("app-owned");
    });

    it("is idempotent and safe after stop", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      runtime.stop();

      expect(() => {
        runtime.destroy();
        runtime.destroy();
      }).not.toThrow();
      expect(canvas.paintListeners.size).toBe(0);
      expect(canvas.getAttribute("content")).toBeNull();
    });

    it("keeps stop idempotent and safe after destroy", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      expect(() => {
        runtime.stop();
        runtime.stop();
        runtime.destroy();
        runtime.stop();
        runtime.stop();
      }).not.toThrow();
    });

    it("does not accept new runtime work after destroy", async () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);

      runtime.destroy();

      expect(() => {
        runtime.start();
      }).toThrow(
        "Cannot start a destroyed CanvasRuntime. Create a new CanvasRuntime instead."
      );
      expect(() => {
        runtime.onPaint(() => {});
      }).toThrow(
        "Cannot register a paint handler on a destroyed CanvasRuntime. Create a new CanvasRuntime instead."
      );
      expect(() => {
        runtime.onUpdate(() => {});
      }).toThrow(
        "Cannot register an update handler on a destroyed CanvasRuntime. Create a new CanvasRuntime instead."
      );
      expect(() => {
        runtime.registerSurface(element as unknown as HTMLElement, {
          bounds: { x: 0, y: 0, width: 100, height: 50 }
        });
      }).toThrow(
        "Cannot register a surface with a destroyed CanvasRuntime. Create a new CanvasRuntime instead."
      );
      await expect(runtime.paintOnce()).rejects.toThrow(
        "Cannot paint a destroyed CanvasRuntime. Create a new CanvasRuntime instead."
      );
    });

    it("does not schedule future frames when destroyed during update", () => {
      const raf = new ManualRaf();
      vi.stubGlobal("requestAnimationFrame", raf.request);
      vi.stubGlobal("cancelAnimationFrame", raf.cancel);
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      let updateCount = 0;

      runtime.onUpdate(() => {
        updateCount += 1;
        runtime.destroy();
      });

      runtime.start();

      expect(raf.pendingCount).toBe(1);

      raf.step();

      expect(updateCount).toBe(1);
      expect(raf.pendingCount).toBe(0);
      expect(() => {
        runtime.destroy();
      }).not.toThrow();
    });

    it("does not schedule future frames when destroyed during paint", () => {
      const raf = new ManualRaf();
      vi.stubGlobal("requestAnimationFrame", raf.request);
      vi.stubGlobal("cancelAnimationFrame", raf.cancel);
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      let paintCount = 0;

      runtime.onPaint(() => {
        paintCount += 1;
        runtime.destroy();
      });

      runtime.start();

      expect(raf.pendingCount).toBe(1);

      raf.step();

      expect(paintCount).toBe(1);
      expect(raf.pendingCount).toBe(0);
      expect(() => {
        runtime.destroy();
      }).not.toThrow();
    });
  });
  describe("exclusive ownership regressions", () => {
    const bounds = { x: 0, y: 0, width: 20, height: 20 };
    function makeRuntime(document: FakeDocument) {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      return {
        canvas,
        runtime: new CanvasRuntime(canvas as unknown as HTMLCanvasElement)
      };
    }
    it("rejects cross-runtime claims without moving the first owner's element", () => {
      const first = makeRuntime(document),
        second = makeRuntime(document);
      const element = document.createElement("section");
      const surface = first.runtime.registerSurface(element as unknown as HTMLElement, {
        bounds
      });
      try {
        expect(() =>
          second.runtime.registerSurface(element as unknown as HTMLElement, { bounds })
        ).toThrow(/already.*own/i);
        expect(element.parentElement).toBe(first.canvas);
        surface.dispose();
        const replacement = second.runtime.registerSurface(
          element as unknown as HTMLElement,
          { bounds }
        );
        first.runtime.destroy();
        expect(element.parentElement).toBe(second.canvas);
        expect(replacement.isDisposed).toBe(false);
      } finally {
        first.runtime.destroy();
        second.runtime.destroy();
      }
    });
    it("rejects a second runtime on an owned canvas and releases it on destroy", () => {
      const first = makeRuntime(document);
      let unexpected: CanvasRuntime | undefined;
      try {
        expect(() => {
          unexpected = new CanvasRuntime(first.canvas as unknown as HTMLCanvasElement);
        }).toThrow(/already.*own/i);
      } finally {
        unexpected?.destroy();
        first.runtime.destroy();
      }
      const next = new CanvasRuntime(first.canvas as unknown as HTMLCanvasElement);
      next.destroy();
    });
    it("rolls back registration when its invalidation throws", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const parent = document.createElement("main"),
        element = document.createElement("section");
      parent.appendChild(element);
      canvas.requestPaint = () => {
        throw new Error("request refused");
      };
      try {
        expect(() =>
          runtime.registerSurface(element as unknown as HTMLElement, { bounds })
        ).toThrow("request refused");
        expect(parent.children).toEqual([element]);
        expect(element.getAttribute("data-prism-surface")).toBeNull();
        canvas.requestPaint = () => {};
        const replacement = runtime.registerSurface(element as unknown as HTMLElement, {
          bounds
        });
        expect(replacement.isDisposed).toBe(false);
      } finally {
        canvas.requestPaint = () => {};
        runtime.destroy();
      }
    });
    it("releases every owner when one DOM restoration throws during destroy", () => {
      const first = makeRuntime(document),
        second = makeRuntime(document);
      const parent = document.createElement("main");
      const a = document.createElement("section"),
        b = document.createElement("aside");
      parent.appendChild(a);
      parent.appendChild(b);
      const sa = first.runtime.registerSurface(a as unknown as HTMLElement, { bounds });
      const sb = first.runtime.registerSurface(b as unknown as HTMLElement, { bounds });
      const restore = parent.insertBefore.bind(parent);
      const spy = vi.spyOn(parent, "insertBefore").mockImplementation((el, before) => {
        if (el === a) throw new Error("restore refused");
        return restore(el, before);
      });
      try {
        expect(() => first.runtime.destroy()).toThrow("restore refused");
        expect(sa.isDisposed).toBe(true);
        expect(sb.isDisposed).toBe(true);
        expect(b.parentElement).toBe(parent);
      } finally {
        spy.mockRestore();
      }
      try {
        expect(() =>
          second.runtime.registerSurface(a as unknown as HTMLElement, { bounds })
        ).not.toThrow();
        expect(() =>
          second.runtime.registerSurface(b as unknown as HTMLElement, { bounds })
        ).not.toThrow();
      } finally {
        second.runtime.destroy();
      }
    });
  });

  describe("current native contract", () => {
    function native(timeout = 100) {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement, {
        backend: "native",
        nativePaintTimeoutMs: timeout
      });
      return { canvas, runtime };
    }
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    it("distinguishes legacy and partial shapes without claiming working rendering", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      delete (canvas as Partial<FakeCanvas>).content;
      expect(
        () =>
          new CanvasRuntime(canvas as unknown as HTMLCanvasElement, { backend: "native" })
      ).toThrow(/alpha.8/);
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      expect(runtime.backendKind).toBe("fallback");
      expect(runtime.diagnostics.capability).toBe("unsupported-version");
      runtime.destroy();
      canvas.content = "fallback";
      delete canvas.requestPaint;
      expect(
        () =>
          new CanvasRuntime(canvas as unknown as HTMLCanvasElement, { backend: "native" })
      ).toThrow(/unsupported/);
    });
    it("cleans up a failed constructor so the same canvas can be retried", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const getRect = vi.spyOn(canvas, "addEventListener").mockImplementation(() => {
        throw new Error("listener refused");
      });
      expect(() => new CanvasRuntime(canvas as unknown as HTMLCanvasElement)).toThrow(
        "listener refused"
      );
      expect(canvas.getAttribute("content")).toBeNull();
      getRect.mockRestore();
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      runtime.destroy();
      expect(canvas.paintListeners.size).toBe(0);
    });
    it("manages current attributes and leaves application transforms untouched", async () => {
      const { canvas, runtime } = native();
      const element = document.createElement("section");
      element.style.transform = "translate(13px, 7px) rotate(8deg)";
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 10, y: 20, width: 30, height: 40 }
      });
      runtime.onPaint(({ drawSurface }) => drawSurface(surface));
      try {
        expect(canvas.getAttribute("content")).toBe("drawable");
        expect(element.getAttribute("drawable")).toBe("");
        const paint = runtime.paintOnce();
        emitPaint(canvas);
        await paint;
        expect(element.style.transform).toBe("translate(13px, 7px) rotate(8deg)");
        expect(element.style.pointerEvents).toBe("auto");
        expect(runtime.diagnostics.health).toBe("healthy");
      } finally {
        runtime.destroy();
      }
      expect(canvas.getAttribute("content")).toBeNull();
      expect(element.getAttribute("drawable")).toBeNull();
    });
    it("preserves app-owned current attributes and refuses incompatible content", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      canvas.setAttribute("content", "fallback");
      expect(() => new CanvasRuntime(canvas as unknown as HTMLCanvasElement)).toThrow(
        /content/
      );
      canvas.setAttribute("content", "drawable");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const el = document.createElement("section");
      el.setAttribute("drawable", "app");
      runtime.registerSurface(el as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 5, height: 5 }
      });
      runtime.destroy();
      expect(canvas.getAttribute("content")).toBe("drawable");
      expect(el.getAttribute("drawable")).toBe("app");
    });
    it("resumes remaining visible time without resetting across visibility changes or stop", async () => {
      const { runtime } = native();
      const rejected = runtime.paintOnce().catch((error: unknown) => error);
      try {
        await vi.advanceTimersByTimeAsync(30);
        document.setVisibility("hidden");
        await vi.advanceTimersByTimeAsync(500);
        runtime.stop();
        document.setVisibility("visible");
        await vi.advanceTimersByTimeAsync(30);
        document.setVisibility("hidden");
        await vi.advanceTimersByTimeAsync(500);
        document.setVisibility("visible");
        await vi.advanceTimersByTimeAsync(39);
        expect(runtime.diagnostics.health).toBe("pending");
        await vi.advanceTimersByTimeAsync(1);
        expect(await rejected).toMatchObject({ code: "paint-timeout" });
        expect(runtime.diagnostics.health).toBe("failed");
        expect(document.visibilityListeners.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        runtime.destroy();
      }
    });
    it("settles a paint while hidden and removes its visibility listener", async () => {
      document.setVisibility("hidden");
      const { canvas, runtime } = native();
      const paint = runtime.paintOnce();
      try {
        await vi.advanceTimersByTimeAsync(1000);
        emitPaint(canvas);
        await paint;
        expect(runtime.diagnostics.health).toBe("healthy");
        expect(document.visibilityListeners.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        runtime.destroy();
      }
    });
    it("coalesces waiters but keeps a request inside paint for the next pass", async () => {
      const { canvas, runtime } = native();
      let next: Promise<void> | undefined,
        nextSettled = false;
      runtime.onPaint(() => {
        if (!next)
          next = runtime.paintOnce().then(() => {
            nextSettled = true;
          });
      });
      const first = runtime.paintOnce(),
        second = runtime.paintOnce();
      try {
        expect(canvas.requestPaintCount).toBe(1);
        emitPaint(canvas);
        await Promise.all([first, second]);
        expect(nextSettled).toBe(false);
        expect(runtime.diagnostics.health).toBe("pending");
        emitPaint(canvas);
        await next;
        expect(nextSettled).toBe(true);
        expect(document.visibilityListeners.size).toBe(0);
      } finally {
        runtime.destroy();
      }
    });
    it("does not revive timed-out callers on a late paint and can recover health", async () => {
      const { canvas, runtime } = native();
      let settled = 0;
      const result = runtime.paintOnce().then(
        () => {
          settled++;
        },
        (error: unknown) => {
          settled++;
          return error;
        }
      );
      try {
        await vi.advanceTimersByTimeAsync(100);
        const error = await result;
        expect(error).toMatchObject({ code: "paint-timeout" });
        emitPaint(canvas);
        expect(settled).toBe(1);
        expect(await result).toBe(error);
        expect(runtime.diagnostics.health).toBe("healthy");
        expect(runtime.backendKind).toBe("native");
      } finally {
        runtime.destroy();
      }
    });
    it("rejects all waiters and releases deadline resources on destroy", async () => {
      const { runtime } = native();
      const a = runtime.paintOnce().catch((error: unknown) => error),
        b = runtime.paintOnce().catch((error: unknown) => error);
      runtime.destroy();
      expect(await a).toBeInstanceOf(Error);
      expect(await b).toBeInstanceOf(Error);
      expect(document.visibilityListeners.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });
    it("wraps a native draw error once with its original cause", async () => {
      const { canvas, runtime } = native();
      const cause = new Error("browser draw refused");
      const el = document.createElement("section");
      const surface = runtime.registerSurface(el as unknown as HTMLElement, {
        bounds: { x: 0, y: 0, width: 5, height: 5 }
      });
      canvas.context.drawElementImage = () => {
        throw cause;
      };
      runtime.onPaint(({ drawSurface }) => drawSurface(surface));
      const result = runtime.paintOnce().catch((error: unknown) => error);
      try {
        try {
          emitPaint(canvas);
        } catch {
          /* Baseline onpaint propagates the draw error. */
        }
        expect(await result).toMatchObject({ code: "draw-failed", cause });
        expect(runtime.diagnostics.health).toBe("failed");
        expect(runtime.backendKind).toBe("native");
      } finally {
        runtime.destroy();
      }
    });
    it("rejects a request destroyed from inside its own paint handler", async () => {
      const { canvas, runtime } = native();
      runtime.onPaint(() => runtime.destroy());
      const result = runtime.paintOnce().then(
        () => "resolved",
        (error: unknown) => error
      );
      emitPaint(canvas);
      expect(await result).toBeInstanceOf(Error);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
  describe("reentrant ownership regressions", () => {
    const bounds = { x: 0, y: 0, width: 20, height: 20 };
    it("releases canvas ownership even if constructor rollback throws", () => {
      const canvas = new FakeCanvas(true);
      canvas.ownerDocument = document;
      const add = vi.spyOn(canvas, "addEventListener").mockImplementation(() => {
        throw new Error("initial listener refusal");
      });
      const remove = vi.spyOn(canvas, "removeAttribute").mockImplementation(() => {
        throw new Error("cleanup attribute refusal");
      });
      expect(() => new CanvasRuntime(canvas as unknown as HTMLCanvasElement)).toThrow();
      add.mockRestore(); remove.mockRestore();
      let replacement: CanvasRuntime | undefined;
      try {
        expect(() => { replacement = new CanvasRuntime(canvas as unknown as HTMLCanvasElement); }).not.toThrow();
      } finally { replacement?.destroy(); }
    });
    it("does not leave a new live surface after a DOM callback destroys the registering runtime", () => {
      const canvas = new FakeCanvas(false); canvas.ownerDocument = document;
      const nextCanvas = new FakeCanvas(false); nextCanvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const next = new CanvasRuntime(nextCanvas as unknown as HTMLCanvasElement);
      const parent = document.createElement("main"), element = document.createElement("custom-element");
      parent.appendChild(element);
      const append = canvas.appendChild.bind(canvas);
      const spy = vi.spyOn(canvas, "appendChild").mockImplementation(el => {
        const result = append(el);
        runtime.destroy(); // models synchronous custom-element connectedCallback
        return result;
      });
      let leaked: ReturnType<CanvasRuntime["registerSurface"]> | undefined;
      try {
        try { leaked = runtime.registerSurface(element as unknown as HTMLElement, { bounds }); } catch { /* Registration may correctly reject destruction. */ }
        expect(() => next.registerSurface(element as unknown as HTMLElement, { bounds })).not.toThrow();
      } finally { spy.mockRestore(); leaked?.dispose(); runtime.destroy(); next.destroy(); }
    });
    it("does not draw or reactivate a surface disposed by its public bounds callback", async () => {
      const canvas = new FakeCanvas(true); canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const element = document.createElement("section");
      const surface = runtime.registerSurface(element as unknown as HTMLElement, { bounds: () => {
        surface.dispose();
        return bounds;
      } });
      runtime.onPaint(({ drawSurface }) => drawSurface(surface));
      const result = runtime.paintOnce().catch((error: unknown) => error);
      try {
        emitPaint(canvas); await result;
        expect(canvas.context.drawElementImageCalls).toHaveLength(0);
        expect(element.style.pointerEvents).not.toBe("auto");
      } finally { runtime.destroy(); }
    });
  });

  it("rolls back registration destroyed by an attribute callback", () => {
    const canvas = new FakeCanvas(true); canvas.ownerDocument = document;
    const nextCanvas = new FakeCanvas(false); nextCanvas.ownerDocument = document;
    const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
    const next = new CanvasRuntime(nextCanvas as unknown as HTMLCanvasElement);
    const parent = document.createElement("main"), element = document.createElement("section");
    parent.appendChild(element);
    const set = element.setAttribute.bind(element);
    const spy = vi.spyOn(element, "setAttribute").mockImplementation((name, value) => {
      set(name, value);
      if (name === "drawable") runtime.destroy();
    });
    try {
      expect(() => runtime.registerSurface(element as unknown as HTMLElement, { bounds: { x: 0, y: 0, width: 20, height: 20 } })).toThrow();
      expect(element.parentElement).toBe(parent);
      expect(() => next.registerSurface(element as unknown as HTMLElement, { bounds: { x: 0, y: 0, width: 20, height: 20 } })).not.toThrow();
    } finally { spy.mockRestore(); runtime.destroy(); next.destroy(); }
  });
  it("does not mutate a new owner after a bounds callback transfers its element", async () => {
    const canvas = new FakeCanvas(true); canvas.ownerDocument = document;
    const nextCanvas = new FakeCanvas(false); nextCanvas.ownerDocument = document;
    const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
    const next = new CanvasRuntime(nextCanvas as unknown as HTMLCanvasElement);
    const element = document.createElement("section");
    const bounds = { x: 0, y: 0, width: 20, height: 20 };
    const surface = runtime.registerSurface(element as unknown as HTMLElement, { bounds: () => {
      surface.dispose();
      next.registerSurface(element as unknown as HTMLElement, { bounds });
      return bounds;
    } });
    runtime.onPaint(({ drawSurface }) => drawSurface(surface));
    const result = runtime.paintOnce().catch((error: unknown) => error);
    try {
      emitPaint(canvas);
      expect(await result).toBeInstanceOf(Error);
      expect(canvas.context.drawElementImageCalls).toHaveLength(0);
      expect(element.parentElement).toBe(nextCanvas);
      expect(element.style.pointerEvents).toBe("none");
    } finally { runtime.destroy(); next.destroy(); }
  });

  describe("attribute callback ownership", () => {
    it.each([false, true])("preserves restored inert after activation disposes a surface (native=%s)", async (native) => {
      const canvas = new FakeCanvas(native); canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const element = document.createElement("section");
      element.inert = true;
      const surface = runtime.registerSurface(element as unknown as HTMLElement, { bounds: { x: 0, y: 0, width: 20, height: 20 } });
      let pointerEvents = element.style.pointerEvents;
      Object.defineProperty(element.style, "pointerEvents", {
        configurable: true,
        get: () => pointerEvents,
        set: (value: string) => { pointerEvents = value; if (value === "auto") surface.dispose(); }
      });
      runtime.onPaint(({ drawSurface }) => drawSurface(surface));
      const result = runtime.paintOnce().catch((error: unknown) => error);
      if (native) emitPaint(canvas);
      await result;
      expect(surface.isDisposed).toBe(true);
      expect(element.inert).toBe(true);
      runtime.destroy();
    });
    it.each(["width", "height", "transform"] as const)("stops fallback writes after a %s callback disposes a surface", async (trigger) => {
      const canvas = new FakeCanvas(false); canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const element = document.createElement("section");
      const surface = runtime.registerSurface(element as unknown as HTMLElement, { bounds: { x: 0, y: 0, width: 20, height: 20 } });
      const staleWrites: string[] = [];
      let disposing = false;
      for (const key of ["width", "height", "transform", "pointerEvents"] as const) {
        let current = element.style[key];
        Object.defineProperty(element.style, key, {
          configurable: true,
          get: () => current,
          set: (value: string) => {
            current = value;
            if (surface.isDisposed && !disposing) staleWrites.push(key);
            if (key === trigger && !surface.isDisposed) {
              disposing = true; surface.dispose(); disposing = false;
            }
          }
        });
      }
      runtime.onPaint(({ drawSurface }) => drawSurface(surface));
      await runtime.paintOnce().catch((error: unknown) => error);
      expect(surface.isDisposed).toBe(true);
      expect(staleWrites).toEqual([]);
      runtime.destroy();
    });
    it.each([false, true])("deactivates remaining surfaces after a callback removes the first (native=%s)", async (native) => {
      const canvas = new FakeCanvas(native); canvas.ownerDocument = document;
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const first = document.createElement("section"), second = document.createElement("section");
      const bounds = { x: 0, y: 0, width: 20, height: 20 };
      const one = runtime.registerSurface(first as unknown as HTMLElement, { bounds });
      const two = runtime.registerSurface(second as unknown as HTMLElement, { bounds });
      let draw = true;
      runtime.onPaint(({ drawSurface }) => { if (draw) { drawSurface(one); drawSurface(two); } });
      const initial = runtime.paintOnce(); if (native) emitPaint(canvas); await initial;
      draw = false;
      let current = first.style.pointerEvents;
      Object.defineProperty(first.style, "pointerEvents", {
        configurable: true,
        get: () => current,
        set: (value: string) => { current = value; if (value === "none") one.dispose(); }
      });
      const result = runtime.paintOnce(); if (native) emitPaint(canvas); await result;
      expect(one.isDisposed).toBe(true);
      expect(second.style.pointerEvents).toBe("none");
      expect(second.inert).toBe(true);
      runtime.destroy();
    });
  });

});
