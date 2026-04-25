import type { CanvasRuntime, CanvasSurface } from "@synthesisengineering/prism";

export type AtlanticSurfaces = Readonly<{
  brand: CanvasSurface;
  overview: CanvasSurface;
  legend: CanvasSurface;
  exportButton: CanvasSurface;
  caption: CanvasSurface;
  tooltip: CanvasSurface;
  detail: CanvasSurface;
}>;

type SurfaceSpec = Readonly<{
  key: keyof AtlanticSurfaces;
  id: string;
  label: string;
}>;

const surfaceSpecs: readonly SurfaceSpec[] = [
  { key: "brand", id: "brand", label: "Prism Atlantic title" },
  { key: "overview", id: "metric", label: "Basin overview" },
  { key: "legend", id: "legend", label: "Saffir-Simpson legend" },
  { key: "exportButton", id: "export", label: "Export PNG" },
  { key: "caption", id: "caption", label: "Data caption" },
  { key: "tooltip", id: "tooltip", label: "Storm tooltip" },
  { key: "detail", id: "panel", label: "Storm detail" }
];

export function registerAtlanticSurfaces(runtime: CanvasRuntime): AtlanticSurfaces {
  // These DOM nodes remain ordinary HTML/CSS UI, but Prism owns their canvas
  // lifecycle once registered. The app updates content and CSS-pixel bounds only.
  const entries = surfaceSpecs.map((spec) => {
    const element = getElement(spec.id);
    const surface = runtime.registerSurface(element, {
      ariaLabel: spec.label,
      bounds: { x: 0, y: 0, width: 1, height: 1 }
    });
    return [spec.key, surface] as const;
  });

  return Object.fromEntries(entries) as AtlanticSurfaces;
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element;
}
