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
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(): void {
    void this.callback;
  }

  disconnect(): void {}
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
    return index === -1 ? null : this.parentNode.children[index + 1] ?? null;
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
  clearCount = 0;
  drawElementImage?: () => DOMMatrix;

  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  font = "";

  constructor(native = false) {
    if (native) {
      this.drawElementImage = () =>
        new FakeDomMatrix().translateSelf(12, 18) as unknown as DOMMatrix;
    }
  }

  reset(): void {}

  clearRect(): void {
    this.clearCount += 1;
  }

  drawImage(): void {
    this.drawImageCount += 1;
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
}

type RuntimeInternals = {
  flushPaint(): void;
};

describe("CanvasRuntime", () => {
  let document: FakeDocument;

  beforeEach(() => {
    document = new FakeDocument();
    vi.stubGlobal("devicePixelRatio", 2);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.stubGlobal("DOMMatrix", FakeDomMatrix);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
        nestedPaints.push(runtime.paintOnce().then(() => {
          nestedResolvedAtPaintCount = paintCount;
        }));
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
    expect(element.parentElement).toBe(canvas);

    runtime.destroy();

    expect(canvas.onpaint).toBeNull();
    expect(surface.isDisposed).toBe(true);
    expect(parent.children).toEqual([element]);
    expect(element.getAttribute("style")).toBeNull();
  });
});
