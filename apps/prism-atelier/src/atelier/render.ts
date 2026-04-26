import type { CanvasRuntime, CanvasSurface } from "@synthesisengineering/prism";
import { drawMode } from "./modes";
import { palettes } from "./palettes";
import type { AtelierState, ModeKind, SourceKind, SourceMetrics } from "./types";
import type { AtelierSurfaces } from "../prism/surfaces";

export type RenderReadout = Readonly<{
  draws: number;
  source: SourceKind;
  mode: ModeKind;
}>;

export function renderAtelierFrame(
  runtime: CanvasRuntime,
  surfaces: AtelierSurfaces,
  metrics: SourceMetrics,
  state: AtelierState,
  drawSurface: (surface: CanvasSurface) => void
): RenderReadout {
  const ctx = runtime.canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Prism Atelier requires a 2D canvas context.");
  }

  drawBackground(ctx, state);
  // The background is plain Canvas 2D. Only the artwork material below comes
  // from registered DOM surfaces.
  const surface = surfaces[state.source];
  const draws = drawMode({ ctx, surface, state, metrics, drawSurface });

  return {
    draws,
    source: state.source,
    mode: state.mode
  };
}

function drawBackground(ctx: CanvasRenderingContext2D, state: AtelierState): void {
  const palette = palettes[state.paletteName];
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(
    width / 2 + state.sx * width * 0.12,
    height / 2 - state.sy * height * 0.1,
    10,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.62
  );
  gradient.addColorStop(0, withAlpha(palette.a, 0.13));
  gradient.addColorStop(0.45, withAlpha(palette.b, 0.045));
  gradient.addColorStop(1, palette.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = palette.c;
  ctx.lineWidth = 1;
  const pixelRatio = width / Math.max(ctx.canvas.clientWidth, 1);
  const gap = 56 * pixelRatio;
  for (let x = (state.time * 8) % gap; x < width; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = (state.time * 5) % gap; y < height; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = palette.a;
  ctx.strokeRect(width * 0.18, height * 0.14, width * 0.64, height * 0.72);
  ctx.restore();
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}
