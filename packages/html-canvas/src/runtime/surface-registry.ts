import { CanvasSurface, setSurfaceLifecycle, type SurfaceOptions } from "../surface";
import { deactivateSurface } from "./surface-activation";

type SurfaceDomState = Readonly<{
  parent: Node | null;
  nextSibling: Node | null;
  style: string | null;
  ariaLabel: string | null;
  prismSurface: string | null;
  inert: boolean | undefined;
}>;

type SurfaceRecord = {
  readonly surface: CanvasSurface;
  readonly domState: SurfaceDomState;
};

export class SurfaceRegistry {
  private readonly records: SurfaceRecord[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onChange: () => void
  ) {}

  register(element: HTMLElement, options: SurfaceOptions): CanvasSurface {
    const existingRecord = this.findByElement(element);
    if (existingRecord) {
      return existingRecord.surface;
    }

    const domState = snapshotSurfaceDomState(element);
    if (element.parentElement !== this.canvas) {
      this.canvas.appendChild(element);
    }

    const surface = new CanvasSurface(element, options);
    setSurfaceLifecycle(surface, {
      unregister: (target) => {
        this.unregister(target);
      }
    });
    surface.element.style.position = "absolute";
    surface.element.style.left = "0";
    surface.element.style.top = "0";
    surface.element.style.transformOrigin = "0 0";
    deactivateSurface(surface);
    this.records.push({ surface, domState });
    this.onChange();
    return surface;
  }

  unregister(surface: CanvasSurface): void {
    const index = this.records.findIndex((record) => record.surface === surface);
    if (index === -1) {
      return;
    }

    const [record] = this.records.splice(index, 1);
    if (!record) {
      return;
    }

    deactivateSurface(record.surface);
    restoreSurfaceDomState(record.surface.element, record.domState);
    this.onChange();
  }

  clear(): void {
    for (const record of [...this.records]) {
      record.surface.dispose();
    }
  }

  forEachSurface(callback: (surface: CanvasSurface) => void): void {
    for (const record of this.records) {
      callback(record.surface);
    }
  }

  assertRegistered(surface: CanvasSurface): void {
    if (!this.records.some((record) => record.surface === surface)) {
      throw new Error("Prism CanvasRuntime can only use surfaces registered with this runtime.");
    }
  }

  private findByElement(element: HTMLElement): SurfaceRecord | undefined {
    return this.records.find((record) => record.surface.element === element);
  }
}

function snapshotSurfaceDomState(element: HTMLElement): SurfaceDomState {
  const inertElement = element as HTMLElement & { inert?: boolean };
  return {
    parent: element.parentNode,
    nextSibling: element.nextSibling,
    style: element.getAttribute("style"),
    ariaLabel: element.getAttribute("aria-label"),
    prismSurface: element.getAttribute("data-prism-surface"),
    inert: "inert" in inertElement ? inertElement.inert : undefined
  };
}

function restoreSurfaceDomState(element: HTMLElement, state: SurfaceDomState): void {
  restoreAttribute(element, "style", state.style);
  restoreAttribute(element, "aria-label", state.ariaLabel);
  restoreAttribute(element, "data-prism-surface", state.prismSurface);

  const inertElement = element as HTMLElement & { inert?: boolean };
  if (state.inert === undefined) {
    if ("inert" in inertElement) {
      inertElement.inert = false;
    }
  } else {
    inertElement.inert = state.inert;
  }

  if (state.parent) {
    state.parent.insertBefore(
      element,
      state.nextSibling?.parentNode === state.parent ? state.nextSibling : null
    );
  } else {
    element.remove();
  }
}

function restoreAttribute(
  element: HTMLElement,
  name: string,
  value: string | null
): void {
  if (value === null) {
    element.removeAttribute(name);
    return;
  }

  element.setAttribute(name, value);
}
