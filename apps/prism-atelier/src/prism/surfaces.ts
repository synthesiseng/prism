import type { CanvasRuntime, CanvasSurface } from "@synthesisengineering/prism";
import type { SourceKind, SourceMetrics } from "../atelier/types";

export type AtelierSurfaces = Readonly<Record<SourceKind, CanvasSurface>>;

type SurfaceSpec = Readonly<{
  id: string;
  label: string;
  width: number;
  height: number;
}>;

const glyphSpec: SurfaceSpec = {
  id: "glyph-surface",
  label: "Prism glyph source",
  width: 240,
  height: 240
};

const typeSpec: SurfaceSpec = {
  id: "type-surface",
  label: "Prism type source",
  width: 760,
  height: 210
};

const cssSpec: SurfaceSpec = {
  id: "css-surface",
  label: "Prism CSS gradient source",
  width: 300,
  height: 300
};

const patternSpec: SurfaceSpec = {
  id: "pattern-surface",
  label: "Prism pattern source",
  width: 260,
  height: 180
};

export const sourceMetrics: SourceMetrics = {
  glyph: { width: glyphSpec.width, height: glyphSpec.height },
  type: { width: typeSpec.width, height: typeSpec.height },
  css: { width: cssSpec.width, height: cssSpec.height },
  pattern: { width: patternSpec.width, height: patternSpec.height }
};

export function registerAtelierSurfaces(runtime: CanvasRuntime): AtelierSurfaces {
  // Each source starts as ordinary inspectable DOM in index.html. Registering it
  // hands lifecycle, paint readiness, and DOM ownership restoration to Prism.
  return {
    glyph: registerSourceSurface(runtime, glyphSpec),
    type: registerSourceSurface(runtime, typeSpec),
    css: registerSourceSurface(runtime, cssSpec),
    pattern: registerSourceSurface(runtime, patternSpec)
  };
}

export function disposeAtelierSurfaces(surfaces: AtelierSurfaces): void {
  // Surface disposal is idempotent. Calling it explicitly makes the example's
  // teardown contract visible instead of relying only on runtime.destroy().
  surfaces.glyph.dispose();
  surfaces.type.dispose();
  surfaces.css.dispose();
  surfaces.pattern.dispose();
}

export function updateTypeSurface(word: string): void {
  const element = getElement("type-surface");
  element.textContent = word || " ";
  element.dataset.textLength = String(word.length);
}

function registerSourceSurface(
  runtime: CanvasRuntime,
  spec: SurfaceSpec
): CanvasSurface {
  const element = getElement(spec.id);
  // Bounds are CSS pixels. Centering every source around (0, 0) lets canvas
  // transforms rotate/scale each DOM surface around its visual center.
  return runtime.registerSurface(element, {
    ariaLabel: spec.label,
    bounds: {
      x: -spec.width / 2,
      y: -spec.height / 2,
      width: spec.width,
      height: spec.height
    }
  });
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element;
}
