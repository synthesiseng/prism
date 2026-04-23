import type { CanvasSurface } from "../surface";

export function activateSurface(surface: CanvasSurface): void {
  setSurfaceInteractivity(surface, true);
}

export function deactivateSurface(surface: CanvasSurface): void {
  setSurfaceInteractivity(surface, false);
}

function setSurfaceInteractivity(surface: CanvasSurface, active: boolean): void {
  surface.element.style.pointerEvents = active ? "auto" : "none";
  const inertElement = surface.element as HTMLElement & { inert?: boolean };
  if ("inert" in inertElement) {
    inertElement.inert = !active;
  }
}
