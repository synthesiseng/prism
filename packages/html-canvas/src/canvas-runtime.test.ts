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

class FakeElement {
  readonly style = new FakeStyle();
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  ownerDocument!: FakeDocument;
  parentNode: FakeElement | null = null;
  parentElement: FakeElement | null = null;
  inert = false;

  constructor(readonly tagName: string) {}

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

class FakeDocument {
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
      expect(canvas.getAttribute("layoutsubtree")).toBe("");

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

    it("returns the existing surface when the same element is registered again", () => {
      const canvas = new FakeCanvas(false);
      canvas.ownerDocument = document;
      const element = document.createElement("section");
      const runtime = new CanvasRuntime(canvas as unknown as HTMLCanvasElement);
      const surface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 1, y: 2, width: 30, height: 40 }
      });

      const sameSurface = runtime.registerSurface(element as unknown as HTMLElement, {
        bounds: { x: 10, y: 20, width: 300, height: 400 }
      });

      expect(sameSurface).toBe(surface);
      expect(surface.getBounds()).toEqual({
        x: 1,
        y: 2,
        width: 30,
        height: 40
      });

      surface.setBounds({ x: 10, y: 20, width: 300, height: 400 });

      expect(surface.getBounds()).toEqual({
        x: 10,
        y: 20,
        width: 300,
        height: 400
      });

      runtime.destroy();
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

      expect(canvas.requestPaintCount).toBe(1);

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
      canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, {} as Event);

      expect(canvas.requestPaintCount).toBe(0);
      expect(element.style.width).toBe("30px");
      expect(element.style.height).toBe("40px");
      expect(element.style.transform).toBe("matrix(1, 0, 0, 1, 12, 18)");

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

      canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, {} as Event);

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

    it("falls back to CSS bounds when native drawElementImage returns no transform", () => {
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

      canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, {} as Event);

      expect(element.style.transform).toBe("matrix(1, 0, 0, 1, 10, 20)");

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

      expect(canvas.requestPaintCount).toBe(1);
      expect(resolved).toBe(false);

      canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, {} as Event);
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

      expect(canvas.requestPaintCount).toBe(1);
      expect(firstResolved).toBe(false);
      expect(secondResolved).toBe(false);

      canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, {} as Event);
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
      canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, {} as Event);
      await firstPaint;

      expect(nestedPaints).toHaveLength(1);
      expect(canvas.requestPaintCount).toBe(2);
      expect(nestedResolvedAtPaintCount).toBe(0);

      canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, {} as Event);
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

      expect(() => {
        canvas.onpaint?.call(canvas as unknown as HTMLCanvasElement, {} as Event);
      }).toThrow("native paint failed");
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

      expect(canvas.onpaint).not.toBeNull();
      expect(canvas.getAttribute("layoutsubtree")).toBe("");
      expect(element.parentElement).toBe(canvas);

      runtime.destroy();

      expect(canvas.onpaint).toBeNull();
      expect(canvas.getAttribute("layoutsubtree")).toBeNull();
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
      expect(canvas.onpaint).toBeNull();
      expect(canvas.getAttribute("layoutsubtree")).toBeNull();
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
      }).toThrow("Cannot start a destroyed CanvasRuntime. Create a new CanvasRuntime instead.");
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
});
