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

  const background = ctx.createRadialGradient(
    width / 2,
    height / 2,
    10,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.7
  );
  background.addColorStop(0, shade(palette.bg, 18));
  background.addColorStop(1, palette.bg);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function shade(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = clampChannel((value >> 16) + amount);
  const g = clampChannel(((value >> 8) & 255) + amount);
  const b = clampChannel((value & 255) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, value));
}
