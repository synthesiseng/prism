import type { CanvasSurface } from "../surface";

export function activateSurface(surface: CanvasSurface): void {
  setSurfaceInteractivity(surface, true);
}

export function deactivateSurface(surface: CanvasSurface): void {
  setSurfaceInteractivity(surface, false);
}

function setSurfaceInteractivity(surface: CanvasSurface, active: boolean): void {
  if (surface.isDisposed) return;
  surface.element.style.pointerEvents = active ? "auto" : "none";
  // A custom element's style callback can synchronously release ownership.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Style callbacks can dispose the surface synchronously.
  if (surface.isDisposed) return;
  const inertElement = surface.element as HTMLElement & { inert?: boolean };
  if ("inert" in inertElement) {
    inertElement.inert = !active;
  }
}
