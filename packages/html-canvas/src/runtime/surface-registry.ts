import { CanvasSurface, setSurfaceLifecycle, type SurfaceOptions } from "../surface";
import { nativePlatform } from "./native-platform";
import { deactivateSurface } from "./surface-activation";

type SurfaceDomState = Readonly<{
  parent: Node | null;
  nextSibling: Node | null;
  placeholder: ChildNode | null;
  style: string | null;
  drawable: string | null;
  ariaLabel: string | null;
  prismSurface: string | null;
  inert: boolean | undefined;
}>;

type SurfaceRecord = {
  readonly surface: CanvasSurface;
  readonly domState: SurfaceDomState;
};

const elementOwners = new WeakMap<HTMLElement, SurfaceRegistry>();

// Internal owner of registered surfaces and DOM round-trip restoration.
export class SurfaceRegistry {
  private readonly records: SurfaceRecord[] = [];
  private closed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onChange: () => void,
    private readonly onBoundsChange: () => void = onChange,
    private readonly native = false
  ) {}

  register(element: HTMLElement, options: SurfaceOptions): CanvasSurface {
    this.assertOpen();
    if (elementOwners.has(element)) {
      throw new Error("Prism surface element is already owned by an active surface.");
    }
    elementOwners.set(element, this);
    let domState: SurfaceDomState | undefined;
    let record: SurfaceRecord | undefined;
    try {
      domState = snapshotSurfaceDomState(element);
      this.assertOpen();
      if (element.parentElement !== this.canvas) this.canvas.appendChild(element);
      this.assertOpen();
      const surface = new CanvasSurface(element, options);
      this.assertOpen();
      setSurfaceLifecycle(surface, {
        invalidate: () => this.onBoundsChange(),
        unregister: (target) => this.unregister(target)
      });
      surface.element.style.position = "absolute";
      surface.element.style.left = "0";
      surface.element.style.top = "0";
      if (this.native) nativePlatform.activateSurface(element);
      else surface.element.style.transformOrigin = "0 0";
      deactivateSurface(surface);
      this.assertOpen();
      record = { surface, domState };
      this.records.push(record);
      this.onChange();
      this.assertOpen();
      return surface;
    } catch (error) {
      // Destruction may already have removed a committed record. Never restore
      // an element after this registration has released its ownership.
      if (elementOwners.get(element) === this) {
        const index = record ? this.records.indexOf(record) : -1;
        if (index !== -1) this.records.splice(index, 1);
        try {
          if (domState) restoreSurfaceDomState(element, domState);
        } finally {
          elementOwners.delete(element);
          domState?.placeholder?.remove();
        }
      }
      throw error;
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("Cannot register a surface with a destroyed Prism runtime.");
  }

  unregister(surface: CanvasSurface): void {
    const index = this.records.findIndex((record) => record.surface === surface);
    if (index === -1) return;
    const [record] = this.records.splice(index, 1);
    if (!record) return;
    try {
      restoreSurfaceDomState(record.surface.element, record.domState);
    } finally {
      elementOwners.delete(record.surface.element);
      record.domState.placeholder?.remove();
    }
    this.onChange();
  }

  clear(): void {
    this.closed = true;
    let failure: Error | undefined;
    for (const record of [...this.records]) {
      try {
        record.surface.dispose();
      } catch (error) {
        failure ??= error instanceof Error ? error : new Error("Surface cleanup failed.", { cause: error });
      }
    }
    if (failure !== undefined) throw failure;
  }

  forEachSurface(callback: (surface: CanvasSurface) => void): void {
    // Attribute callbacks may remove this or another record during iteration.
    for (const record of [...this.records]) {
      if (!record.surface.isDisposed) callback(record.surface);
    }
  }

  assertRegistered(surface: CanvasSurface): void {
    if (!this.records.some((record) => record.surface === surface)) {
      throw new Error(
        "Prism CanvasRuntime can only use surfaces registered with this runtime."
      );
    }
  }
}

function snapshotSurfaceDomState(element: HTMLElement): SurfaceDomState {
  const inertElement = element as HTMLElement & { inert?: boolean };
  const parent = element.parentNode;
  const nextSibling = element.nextSibling;
  const placeholder = parent
    ? element.ownerDocument.createComment("prism-surface")
    : null;
  if (parent && placeholder) {
    parent.insertBefore(placeholder, element);
  }

  return {
    parent,
    nextSibling,
    placeholder,
    style: element.getAttribute("style"),
    drawable: element.getAttribute("drawable"),
    ariaLabel: element.getAttribute("aria-label"),
    prismSurface: element.getAttribute("data-prism-surface"),
    inert: "inert" in inertElement ? inertElement.inert : undefined
  };
}

function restoreSurfaceDomState(element: HTMLElement, state: SurfaceDomState): void {
  // Restore attributes before moving the element back to its original owner.
  restoreAttribute(element, "style", state.style);
  restoreAttribute(element, "drawable", state.drawable);
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
    const restoreBefore =
      state.placeholder?.parentNode === state.parent
        ? state.placeholder
        : state.nextSibling?.parentNode === state.parent
          ? state.nextSibling
          : null;
    state.parent.insertBefore(element, restoreBefore);
    state.placeholder?.remove();
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
