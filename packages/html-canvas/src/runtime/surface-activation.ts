import { writeSurfaceInert, writeSurfaceStyle } from "./dom-writes";
import type { CanvasSurface } from "../surface";

export function activateSurface(surface: CanvasSurface): void {
  setSurfaceInteractivity(surface, true);
}

export function deactivateSurface(surface: CanvasSurface): void {
  setSurfaceInteractivity(surface, false);
}

function setSurfaceInteractivity(surface: CanvasSurface, active: boolean): void {
  if (surface.isDisposed) return;
  const pointerEvents = active ? "auto" : "none";
  let failure: { error: unknown } | undefined;
  try {
    if (surface.element.style.pointerEvents !== pointerEvents ||
        surface.element.style.getPropertyPriority("pointer-events") !== "")
      writeSurfaceStyle(surface.element, "pointer-events", pointerEvents);
  } catch (error) {
    // Failed activation must not enable keyboard focus. Deactivation still
    // attempts both independent fields, preserving the first failure.
    if (active) throw error;
    failure = { error };
  }
  // A custom element's style callback can synchronously release ownership.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Style callbacks can dispose the surface synchronously.
  if (!surface.isDisposed) {
    try {
      const inertElement = surface.element as HTMLElement & { inert?: boolean };
      if ("inert" in inertElement && inertElement.inert !== !active)
        writeSurfaceInert(surface.element, !active);
    } catch (error) {
      failure ??= { error };
    }
  }
  if (failure) throw failure.error;
}
