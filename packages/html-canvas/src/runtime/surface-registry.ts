import type { RectLike } from "@prism/math";
import { beginSurfaceWrites, releaseSurfaceWrites, writeSurfaceStyle, type DomWrites } from "./dom-writes";
import { CanvasSurface, setSurfaceLifecycle, type SurfaceOptions } from "../surface";
import { nativePlatform } from "./native-platform";
import { deactivateSurface } from "./surface-activation";

type SurfaceDomState = Readonly<{
  parent: Node | null;
  nextSibling: Node | null;
  placeholder: ChildNode | null;
  writes: DomWrites;
}>;

type SurfaceRecord = {
  readonly surface: CanvasSurface;
  readonly domState: SurfaceDomState;
  prepared?: Readonly<{ width: number; height: number }>;
  pending?: Readonly<{ width: number; height: number }> | undefined;
};

const elementOwners = new WeakMap<HTMLElement, SurfaceRegistry>();

// Internal owner of registered surfaces and DOM round-trip restoration.
export class SurfaceRegistry {
  private readonly records: SurfaceRecord[] = [];
  private readonly layoutDeferred = new Set<CanvasSurface>();
  private closed = false;
  private preparingLayout = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onChange: () => void,
    private readonly onBoundsChange: (changed: boolean) => void = onChange,
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
        invalidate: (bounds, changed) => {
          if (changed) this.queueLayout(surface, bounds);
          this.onBoundsChange(changed);
        },
        unregister: (target) => this.unregister(target)
      });
      writeSurfaceStyle(element, "position", "absolute");
      writeSurfaceStyle(element, "left", "0");
      writeSurfaceStyle(element, "top", "0");
      if (this.native) nativePlatform.activateSurface(element);
      else writeSurfaceStyle(element, "transform-origin", "0 0");
      deactivateSurface(surface);
      this.assertOpen();
      record = { surface, domState };
      this.records.push(record);
      if (typeof options.bounds !== "function") this.queueLayout(surface, options.bounds);
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
          releaseSurfaceWrites(element);
          elementOwners.delete(element);
          domState?.placeholder?.remove();
        }
      }
      throw error;
    }
  }

  get hasPendingLayout(): boolean {
    return this.native && this.records.some((record) => record.pending !== undefined);
  }

  layoutReady(surface: CanvasSurface, bounds: RectLike): boolean {
    if (!this.native) return true;
    this.queueLayout(surface, bounds);
    return !this.records.find((record) => record.surface === surface)?.pending;
  }

  private queueLayout(surface: CanvasSurface, bounds: RectLike): void {
    if (!this.native) return;
    const record = this.records.find((entry) => entry.surface === surface);
    if (!record) return;
    if (record.prepared?.width === bounds.width && record.prepared.height === bounds.height &&
        record.domState.writes.matchesStyle("width") &&
        record.domState.writes.matchesStyle("height") &&
        record.domState.writes.matchesStyle("box-sizing")) {
      record.pending = undefined;
      return;
    }
    if (record.pending?.width === bounds.width && record.pending.height === bounds.height) return;
    record.pending = { width: bounds.width, height: bounds.height };
  }

  prepareLayout(): void {
    if (this.preparingLayout) return;
    this.preparingLayout = true;
    try {
      for (const record of [...this.records]) {
        const size = record.pending;
        if (!size) continue;
        const current = () => !record.surface.isDisposed &&
          this.records.includes(record) && record.pending === size;
        if (!current()) continue;
        writeSurfaceStyle(record.surface.element, "box-sizing", "border-box");
        if (!current()) continue;
        writeSurfaceStyle(record.surface.element, "width", `${String(size.width)}px`);
        if (!current()) continue;
        writeSurfaceStyle(record.surface.element, "height", `${String(size.height)}px`);
        if (!current()) continue;
        record.prepared = size;
        record.pending = undefined;
      }
    } finally {
      this.preparingLayout = false;
    }
  }

  setLayoutDeferred(surface: CanvasSurface, deferred: boolean): void {
    if (deferred) this.layoutDeferred.add(surface);
    else this.layoutDeferred.delete(surface);
  }

  deactivateDeferred(): void {
    const deferred = [...this.layoutDeferred];
    this.layoutDeferred.clear();
    let failure: { error: unknown } | undefined;
    for (const surface of deferred) {
      if (surface.isDisposed) continue;
      try { deactivateSurface(surface); }
      catch (error) { failure ??= { error }; }
    }
    if (failure) throw failure.error;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("Cannot register a surface with a destroyed Prism runtime.");
  }

  unregister(surface: CanvasSurface): void {
    this.layoutDeferred.delete(surface);
    const index = this.records.findIndex((record) => record.surface === surface);
    if (index === -1) return;
    const [record] = this.records.splice(index, 1);
    if (!record) return;
    try {
      restoreSurfaceDomState(record.surface.element, record.domState);
    } finally {
      releaseSurfaceWrites(record.surface.element);
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
    writes: beginSurfaceWrites(element)
  };
}

function restoreSurfaceDomState(element: HTMLElement, state: SurfaceDomState): void {
  let writeFailed = false;
  let writeFailure: unknown;
  try {
    state.writes.restore();
  } catch (error) {
    writeFailed = true;
    writeFailure = error;
  }

  try {
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
  } catch (error) {
    if (!writeFailed) throw error;
  }
  if (writeFailed) throw writeFailure;
}
