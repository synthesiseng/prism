import type { CanvasRuntime, CanvasSurface } from "@synthesisengineering/prism";
import type { CssStyle, GlyphShape, PatternStyle, SourceKind, SourceMetrics } from "../atelier/types";

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
  width: 640,
  height: 640
};

const patternSpec: SurfaceSpec = {
  id: "pattern-surface",
  label: "Prism pattern source",
  width: 400,
  height: 320
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

export function updateGlyphSurface(shape: GlyphShape): void {
  const element = getElement("glyph-surface");
  element.dataset.shape = shape;
  element.innerHTML = glyphSvg(shape);
}

export function updateCssSurface(style: CssStyle): void {
  const element = getElement("css-surface");
  element.dataset.style = style;
  element.innerHTML = cssMarkup(style);
}

export function updatePatternSurface(style: PatternStyle): void {
  const element = getElement("pattern-surface");
  element.dataset.style = style;
  element.innerHTML = patternSvg(style);
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

function glyphSvg(shape: GlyphShape): string {
  const content = glyphContent(shape);
  return `<svg viewBox="0 0 240 240" role="img" aria-label="Prism glyph">${content}</svg>`;
}

function glyphContent(shape: GlyphShape): string {
  switch (shape) {
    case "triangle":
      return `
        <path class="glyph-line outer" d="M120 20 222 204 18 204Z" />
        <path class="glyph-line inner" d="M120 78 174 176 66 176Z" />
        <circle class="glyph-core" cx="120" cy="144" r="22" />`;
    case "circle":
      return `
        <circle class="glyph-line outer" cx="120" cy="120" r="96" />
        <circle class="glyph-line inner" cx="120" cy="120" r="58" />
        <circle class="glyph-line axis" cx="120" cy="120" r="28" />
        <circle class="glyph-core" cx="120" cy="120" r="13" />`;
    case "star":
      return `
        <path class="glyph-line outer" d="M120 18 143 84 212 86 157 128 176 196 120 158 64 196 83 128 28 86 97 84Z" />
        <circle class="glyph-core" cx="120" cy="120" r="20" />`;
    case "cross":
      return `
        <path class="glyph-line outer" d="M108 24H132V108H216V132H132V216H108V132H24V108H108Z" />
        <circle class="glyph-core" cx="120" cy="120" r="19" />`;
    case "hexagon":
      return `
        <path class="glyph-line outer" d="M120 18 208 69V171L120 222 32 171V69Z" />
        <path class="glyph-line inner" d="M120 62 170 91V149L120 178 70 149V91Z" />
        <circle class="glyph-core" cx="120" cy="120" r="22" />`;
    case "diamond":
      return `
        <path class="glyph-line outer" d="M120 18 222 120 120 222 18 120Z" />
        <path class="glyph-line inner" d="M120 66 174 120 120 174 66 120Z" />
        <path class="glyph-line axis" d="M18 120H222M120 18V222" />
        <circle class="glyph-core" cx="120" cy="120" r="23" />`;
  }
}

function patternSvg(style: PatternStyle): string {
  return `<svg viewBox="0 0 400 320" role="img" aria-label="Prism pattern tile">${patternContent(style)}</svg>`;
}

function cssMarkup(style: CssStyle): string {
  switch (style) {
    case "linear":
      return Array.from({ length: 14 }, (_, index) => {
        const y = -180 + index * 26;
        const alpha = 0.18 + (index / 14) * 0.5;
        return `<span class="css-mark css-bar" style="--x:-200px;--y:${String(y)}px;--w:400px;--h:18px;--a:${alpha.toFixed(3)}"></span>`;
      }).join("");
    case "blob":
      return Array.from({ length: 7 }, (_, index) => {
        const off = (6 - index) * 14;
        const a = 0.16 + (6 - index) * 0.05;
        const b = 0.14 + (6 - index) * 0.05;
        return `
          <span class="css-mark css-circle" style="--x:${String(-off * 0.6)}px;--y:${String(-off * 0.4)}px;--s:${String(240 + (6 - index) * 44)}px;--a:${a.toFixed(3)}"></span>
          <span class="css-mark css-circle" style="--x:${String(off * 0.7)}px;--y:${String(off * 0.5)}px;--s:${String(240 + (6 - index) * 36)}px;--a:${b.toFixed(3)}"></span>`;
      }).join("");
    case "radial":
      return Array.from({ length: 8 }, (_, index) => {
        const i = 7 - index;
        const radius = 50 + i * 24;
        const alpha = 0.14 + i * 0.04;
        return `<span class="css-mark css-circle" style="--x:0px;--y:0px;--s:${String(radius * 2)}px;--a:${alpha.toFixed(3)}"></span>`;
      }).join("");
  }
}

function patternContent(style: PatternStyle): string {
  switch (style) {
    case "lines":
      return `
        <g transform="translate(200 160)" fill="currentColor">
          <rect x="-180" y="-93" width="360" height="6" rx="3" />
          <rect x="-180" y="-63" width="360" height="6" rx="3" />
          <rect x="-180" y="-33" width="360" height="6" rx="3" />
          <rect x="-180" y="-3" width="360" height="6" rx="3" />
          <rect x="-180" y="27" width="360" height="6" rx="3" />
          <rect x="-180" y="57" width="360" height="6" rx="3" />
          <rect x="-180" y="87" width="360" height="6" rx="3" />
        </g>`;
    case "grid":
      return `
        <g transform="translate(200 160)">
          <rect x="-60" y="-60" width="120" height="120" fill="none" stroke="currentColor" stroke-width="6" />
          <path d="M-60 -60 60 60M60 -60 -60 60" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          <circle cx="0" cy="0" r="36" fill="currentColor" />
        </g>`;
    case "dots":
      return `
        <g transform="translate(200 160)" fill="currentColor">
          <circle cx="-120" cy="-120" r="14" />
          <circle cx="-60" cy="-120" r="14" />
          <circle cx="0" cy="-120" r="14" />
          <circle cx="60" cy="-120" r="14" />
          <circle cx="120" cy="-120" r="14" />
          <circle cx="-120" cy="-60" r="14" />
          <circle cx="-60" cy="-60" r="14" />
          <circle cx="0" cy="-60" r="14" />
          <circle cx="60" cy="-60" r="14" />
          <circle cx="120" cy="-60" r="14" />
          <circle cx="-120" cy="0" r="14" />
          <circle cx="-60" cy="0" r="14" />
          <circle cx="0" cy="0" r="14" />
          <circle cx="60" cy="0" r="14" />
          <circle cx="120" cy="0" r="14" />
          <circle cx="-120" cy="60" r="14" />
          <circle cx="-60" cy="60" r="14" />
          <circle cx="0" cy="60" r="14" />
          <circle cx="60" cy="60" r="14" />
          <circle cx="120" cy="60" r="14" />
          <circle cx="-120" cy="120" r="14" />
          <circle cx="-60" cy="120" r="14" />
          <circle cx="0" cy="120" r="14" />
          <circle cx="60" cy="120" r="14" />
          <circle cx="120" cy="120" r="14" />
        </g>`;
  }
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element;
}
