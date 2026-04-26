import { CanvasRuntime } from "@synthesisengineering/prism";

type Bounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type LifecycleCycleResult = Readonly<{
  cycle: number;
  backendKind: string;
  retainedPrismSurfaceElements: number;
  retainedPrismComments: number;
  retainedCanvases: number;
  restoredElements: number;
  canvasOnpaintCleared: boolean;
  preservedAppLayoutSubtree: boolean;
  clearedRuntimeLayoutSubtree: boolean;
}>;

type DisposedSurfaceResult = Readonly<{
  isDisposed: boolean;
  parentRestored: boolean;
  styleRestored: boolean;
  prismAttributeRemoved: boolean;
  getBoundsThrew: boolean;
  setBoundsThrew: boolean;
  drawDisposedRejected: boolean;
}>;

type DestroyedRuntimeResult = Readonly<{
  startThrew: boolean;
  onPaintThrew: boolean;
  onUpdateThrew: boolean;
  registerSurfaceThrew: boolean;
  paintOnceRejected: boolean;
  stopIdempotent: boolean;
  destroyIdempotent: boolean;
}>;

type PaintLoopResult = Readonly<{
  updateCountBeforeDestroy: number;
  paintCountBeforeDestroy: number;
  updateCountAfterDestroy: number;
  paintCountAfterDestroy: number;
  stopped: boolean;
}>;

type ResizeCleanupResult = Readonly<{
  parentRestored: boolean;
  styleRestored: boolean;
  prismAttributeRemoved: boolean;
  noRetainedCanvasChildren: boolean;
  noRetainedPrismComments: boolean;
}>;

type PrismLifecycleFixture = Readonly<{
  runCreateDestroyCycles(cycles: number): Promise<LifecycleCycleResult[]>;
  testDisposedSurfaceBehavior(): Promise<DisposedSurfaceResult>;
  testDestroyedRuntimeBehavior(): Promise<DestroyedRuntimeResult>;
  testNoPaintLoopAfterDestroy(): Promise<PaintLoopResult>;
  testResizeBoundsCleanup(): Promise<ResizeCleanupResult>;
}>;

declare global {
  interface Window {
    prismLifecycleFixture: PrismLifecycleFixture;
  }
}

const fixtureRoot = document.querySelector<HTMLElement>("#fixture-root");

if (!fixtureRoot) {
  throw new Error("Missing lifecycle fixture root.");
}

window.prismLifecycleFixture = {
  runCreateDestroyCycles,
  testDisposedSurfaceBehavior,
  testDestroyedRuntimeBehavior,
  testNoPaintLoopAfterDestroy,
  testResizeBoundsCleanup
};

async function runCreateDestroyCycles(cycles: number): Promise<LifecycleCycleResult[]> {
  const results: LifecycleCycleResult[] = [];

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const root = createCycleRoot(cycle);
    const canvas = createCanvas(cycle);
    const appLayoutSubtree = cycle % 2 === 0;

    if (appLayoutSubtree) {
      canvas.setAttribute("layoutsubtree", "app-owned");
    }

    root.appendChild(canvas);
    const sources = createSourceElements(root, cycle, 4);
    const snapshots = sources.map(snapshotElement);
    const runtime = new CanvasRuntime(canvas, { backend: "fallback" });
    let paintCount = 0;
    let updateCount = 0;
    const surfaces = sources.map((source, index) =>
      runtime.registerSurface(source, {
        bounds: cycleBounds(cycle, index),
        ariaLabel: `Runtime surface ${String(cycle)}-${String(index)}`
      })
    );

    runtime.onUpdate(() => {
      updateCount += 1;
    });
    runtime.onPaint(({ drawSurface }) => {
      paintCount += 1;
      for (const surface of surfaces) {
        if (!surface.isDisposed) {
          drawSurface(surface);
        }
      }
    });

    surfaces.forEach((surface, index) => {
      surface.setBounds(cycleBounds(cycle + 1, index));
    });

    await runtime.paintOnce();
    runtime.start();
    runtime.invalidate();
    await nextAnimationFrame();
    runtime.stop();

    runtime.unregisterSurface(surfaces[0]);
    surfaces[1].dispose();

    await runtime.paintOnce();

    runtime.destroy();

    if (paintCount < 2 || updateCount < 1) {
      throw new Error("Expected runtime update and paint handlers to run during lifecycle cycle.");
    }

    const restoredElements = sources.filter((source, index) =>
      matchesSnapshot(source, snapshots[index])
    ).length;
    const preservedAppLayoutSubtree = appLayoutSubtree
      ? canvas.getAttribute("layoutsubtree") === "app-owned"
      : true;
    const clearedRuntimeLayoutSubtree = appLayoutSubtree
      ? true
      : !canvas.hasAttribute("layoutsubtree");

    root.remove();

    results.push({
      cycle,
      backendKind: runtime.backendKind,
      retainedPrismSurfaceElements: document.querySelectorAll("[data-prism-surface]").length,
      retainedPrismComments: countPrismComments(document.body),
      retainedCanvases: document.querySelectorAll("canvas").length,
      restoredElements,
      canvasOnpaintCleared: canvas.onpaint == null,
      preservedAppLayoutSubtree,
      clearedRuntimeLayoutSubtree
    });
  }

  return results;
}

async function testDisposedSurfaceBehavior(): Promise<DisposedSurfaceResult> {
  const root = createCycleRoot(1000);
  const canvas = createCanvas(1000);
  const element = createSourceElement(1000, 0);
  const snapshot = snapshotElement(element);
  root.append(canvas, element);

  const runtime = new CanvasRuntime(canvas, { backend: "fallback" });
  const surface = runtime.registerSurface(element, {
    bounds: { x: 8, y: 12, width: 120, height: 48 }
  });

  await runtime.paintOnce();
  surface.dispose();

  const getBoundsThrew = didThrow(() => surface.getBounds());
  const setBoundsThrew = didThrow(() => {
    surface.setBounds({ x: 0, y: 0, width: 1, height: 1 });
  });

  runtime.onPaint(({ drawSurface }) => {
    drawSurface(surface);
  });
  const drawDisposedRejected = await didReject(runtime.paintOnce());

  const result: DisposedSurfaceResult = {
    isDisposed: surface.isDisposed,
    parentRestored: element.parentElement === root,
    styleRestored: element.getAttribute("style") === snapshot.style,
    prismAttributeRemoved: element.getAttribute("data-prism-surface") === snapshot.prismSurface,
    getBoundsThrew,
    setBoundsThrew,
    drawDisposedRejected
  };

  runtime.destroy();
  root.remove();
  return result;
}

async function testDestroyedRuntimeBehavior(): Promise<DestroyedRuntimeResult> {
  const root = createCycleRoot(2000);
  const canvas = createCanvas(2000);
  const element = createSourceElement(2000, 0);
  root.append(canvas, element);

  const runtime = new CanvasRuntime(canvas, { backend: "fallback" });
  runtime.destroy();

  const result: DestroyedRuntimeResult = {
    startThrew: didThrow(() => runtime.start()),
    onPaintThrew: didThrow(() => {
      runtime.onPaint(() => {});
    }),
    onUpdateThrew: didThrow(() => {
      runtime.onUpdate(() => {});
    }),
    registerSurfaceThrew: didThrow(() => {
      runtime.registerSurface(element, {
        bounds: { x: 0, y: 0, width: 10, height: 10 }
      });
    }),
    paintOnceRejected: await didReject(runtime.paintOnce()),
    stopIdempotent: !didThrow(() => {
      runtime.stop();
      runtime.stop();
    }),
    destroyIdempotent: !didThrow(() => {
      runtime.destroy();
      runtime.destroy();
    })
  };

  root.remove();
  return result;
}

async function testNoPaintLoopAfterDestroy(): Promise<PaintLoopResult> {
  const root = createCycleRoot(3000);
  const canvas = createCanvas(3000);
  const element = createSourceElement(3000, 0);
  root.append(canvas, element);

  const runtime = new CanvasRuntime(canvas, { backend: "fallback" });
  const surface = runtime.registerSurface(element, {
    bounds: { x: 0, y: 0, width: 100, height: 50 }
  });
  let updateCount = 0;
  let paintCount = 0;

  runtime.onUpdate(() => {
    updateCount += 1;
  });
  runtime.onPaint(({ drawSurface }) => {
    paintCount += 1;
    drawSurface(surface);
  });
  runtime.start();
  await waitForCondition(() => updateCount >= 2 && paintCount >= 2);

  runtime.destroy();
  const updateCountBeforeDestroy = updateCount;
  const paintCountBeforeDestroy = paintCount;

  await animationFrames(4);

  const result: PaintLoopResult = {
    updateCountBeforeDestroy,
    paintCountBeforeDestroy,
    updateCountAfterDestroy: updateCount,
    paintCountAfterDestroy: paintCount,
    stopped: updateCount === updateCountBeforeDestroy && paintCount === paintCountBeforeDestroy
  };

  root.remove();
  return result;
}

async function testResizeBoundsCleanup(): Promise<ResizeCleanupResult> {
  const root = createCycleRoot(4000);
  const canvas = createCanvas(4000);
  const element = createSourceElement(4000, 0);
  const snapshot = snapshotElement(element);
  root.append(canvas, element);

  const runtime = new CanvasRuntime(canvas, { backend: "fallback" });
  const surface = runtime.registerSurface(element, {
    bounds: { x: 4, y: 6, width: 90, height: 40 }
  });

  runtime.onPaint(({ drawSurface }) => {
    drawSurface(surface);
  });

  for (let index = 0; index < 5; index += 1) {
    canvas.style.width = `${String(320 + index * 20)}px`;
    canvas.style.height = `${String(180 + index * 10)}px`;
    surface.setBounds({
      x: 6 + index * 3,
      y: 8 + index * 2,
      width: 100 + index * 4,
      height: 44 + index * 3
    });
    await runtime.paintOnce();
  }

  runtime.destroy();

  const result: ResizeCleanupResult = {
    parentRestored: element.parentElement === root,
    styleRestored: element.getAttribute("style") === snapshot.style,
    prismAttributeRemoved: element.getAttribute("data-prism-surface") === snapshot.prismSurface,
    noRetainedCanvasChildren: canvas.children.length === 0,
    noRetainedPrismComments: countPrismComments(root) === 0
  };

  root.remove();
  return result;
}

function createCycleRoot(cycle: number): HTMLElement {
  const root = document.createElement("section");
  root.dataset.fixtureCycle = String(cycle);
  fixtureRoot.appendChild(root);
  return root;
}

function createCanvas(cycle: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  canvas.style.width = "320px";
  canvas.style.height = "180px";
  canvas.dataset.fixtureCanvas = String(cycle);
  return canvas;
}

function createSourceElements(parent: HTMLElement, cycle: number, count: number): HTMLElement[] {
  const elements: HTMLElement[] = [];
  for (let index = 0; index < count; index += 1) {
    const element = createSourceElement(cycle, index);
    parent.appendChild(element);
    elements.push(element);
  }
  return elements;
}

function createSourceElement(cycle: number, index: number): HTMLElement {
  const element = document.createElement(index % 2 === 0 ? "article" : "section");
  element.textContent = `Surface ${String(cycle)}-${String(index)}`;
  element.setAttribute(
    "style",
    [
      "position: relative",
      `transform: translate(${String(index)}px, ${String(cycle % 5)}px)`,
      "pointer-events: auto",
      `color: rgb(${String(20 + index)}, ${String(30 + index)}, ${String(40 + index)})`
    ].join("; ")
  );
  element.setAttribute("aria-label", `App surface ${String(cycle)}-${String(index)}`);
  element.setAttribute("data-app-owned", `surface-${String(index)}`);
  return element;
}

function cycleBounds(cycle: number, index: number): Bounds {
  return {
    x: 8 + index * 34 + cycle % 7,
    y: 12 + index * 14,
    width: 80 + index * 5,
    height: 36 + index * 4
  };
}

function snapshotElement(element: HTMLElement): Readonly<{
  parent: HTMLElement | null;
  style: string | null;
  ariaLabel: string | null;
  appOwned: string | null;
  prismSurface: string | null;
}> {
  return {
    parent: element.parentElement,
    style: element.getAttribute("style"),
    ariaLabel: element.getAttribute("aria-label"),
    appOwned: element.getAttribute("data-app-owned"),
    prismSurface: element.getAttribute("data-prism-surface")
  };
}

function matchesSnapshot(
  element: HTMLElement,
  snapshot: ReturnType<typeof snapshotElement> | undefined
): boolean {
  return Boolean(
    snapshot &&
      element.parentElement === snapshot.parent &&
      element.getAttribute("style") === snapshot.style &&
      element.getAttribute("aria-label") === snapshot.ariaLabel &&
      element.getAttribute("data-app-owned") === snapshot.appOwned &&
      element.getAttribute("data-prism-surface") === snapshot.prismSurface
  );
}

function countPrismComments(root: Node): number {
  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue === "prism-surface") {
      count += 1;
    }
  }
  return count;
}

function didThrow(callback: () => void): boolean {
  try {
    callback();
    return false;
  } catch {
    return true;
  }
}

async function didReject(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch {
    return true;
  }
}

async function nextAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function animationFrames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await nextAnimationFrame();
  }
}

async function waitForCondition(condition: () => boolean): Promise<void> {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > 2_000) {
      throw new Error("Timed out waiting for lifecycle fixture condition.");
    }
    await nextAnimationFrame();
  }
}
