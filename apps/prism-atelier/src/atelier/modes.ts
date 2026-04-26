import type { CanvasSurface } from "@synthesisengineering/prism";
import { palettes } from "./palettes";
import type { AtelierState, Palette, SourceMetrics } from "./types";

type DrawApi = Readonly<{
  ctx: CanvasRenderingContext2D;
  surface: CanvasSurface;
  state: AtelierState;
  metrics: SourceMetrics;
  drawSurface(surface: CanvasSurface): void;
}>;

export function drawMode(api: DrawApi): number {
  switch (api.state.mode) {
    case "orbit":
      return drawOrbit(api);
    case "trail":
      return drawTrail(api);
    case "split":
      return drawSplit(api);
    case "grid":
      return drawGrid(api);
    case "extrude":
      return drawExtrude(api);
  }
}

function drawExtrude(api: DrawApi): number {
  const { ctx, surface, state, drawSurface } = api;
  const palette = palettes[state.paletteName];
  const layers = 14 + Math.round(depthFromState(state) * 14);
  const center = canvasCenter(ctx);
  const driftX = state.sx * 44;
  const driftY = -state.sy * 32;
  const baseScale = scaleForSource(api) * (0.82 + state.morph * 0.08);
  let draws = 0;

  for (let index = layers; index >= 0; index -= 1) {
    const k = index / layers;
    const x = center.x + driftX * k + Math.sin((k + state.seed) * Math.PI * 2) * 10 * (1 - k);
    const y = center.y + driftY * k + Math.cos((k + state.seed) * Math.PI * 2) * 8 * (1 - k);
    const alpha = (1 - k * 0.72) * (0.28 + (1 - k) * 0.64) * opacityMorph(state);
    const rotation = (state.sx * 0.3 + Math.sin(state.time * 0.55) * 0.025) * (1 - k * 0.2) + k * 0.055;
    const scale = baseScale * (1 - k * 0.16);
    const color = index < 4 ? palette.c : index < layers * 0.45 ? palette.a : palette.b;

    if (index < 3) {
      draws += drawTransformed({ ...api, x: x - 7 * (3 - index), y, rotation, scale, alpha: alpha * 0.72, tint: "#ff3b6b", source: state.source });
      draws += drawTransformed({ ...api, x: x + 7 * (3 - index), y, rotation, scale, alpha: alpha * 0.72, tint: "#3bf0d9", source: state.source });
    }

    draws += drawTransformed({ ctx, surface, drawSurface, x, y, rotation, scale, alpha, tint: color, shadow: palette, source: state.source });
  }

  return draws;
}

function drawOrbit(api: DrawApi): number {
  const { ctx, surface, state, drawSurface } = api;
  const palette = palettes[state.paletteName];
  const center = canvasCenter(ctx);
  const baseCount = 10 + Math.round(depthFromState(state) * 10);
  const ringRotation = state.time * 0.48 + state.sx * 1.2;
  let draws = 0;

  draws += drawTransformed({
    ctx,
    surface,
    drawSurface,
    x: center.x,
    y: center.y,
    rotation: ringRotation * 0.25,
    scale: scaleForSource(api) * 0.46,
    alpha: 0.94 * opacityMorph(state),
    tint: palette.c,
    shadow: palette,
    source: state.source
  });

  draws += drawConstellation(api, scaleForSource(api) * 0.16, 0.34);

  for (let ring = 0; ring < 3; ring += 1) {
    const count = baseCount + ring * 5;
    const radius = 118 + ring * 76 + depthFromState(state) * 58;
    const scale = scaleForSource(api) * (0.3 - ring * 0.06);
    const alpha = (0.72 - ring * 0.16) * opacityMorph(state);
    const direction = ring % 2 === 0 ? 1 : -1;
    const squeeze = 1 - state.sy * 0.18;

    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + ringRotation * direction * (1 + ring * 0.25);
      const color = ring === 0 ? palette.a : ring === 1 ? palette.b : palette.c;
      draws += drawTransformed({
        ctx,
        surface,
        drawSurface,
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius * squeeze,
        rotation: angle + Math.PI / 2,
        scale,
        alpha,
        tint: color,
        composite: "screen",
        shadow: palette,
        source: state.source
      });
    }
  }

  return draws;
}

function drawTrail(api: DrawApi): number {
  const { ctx, surface, state, drawSurface } = api;
  const palette = palettes[state.paletteName];
  const center = canvasCenter(ctx);
  const samples = state.pointerTrail.length > 0
    ? state.pointerTrail
    : Array.from({ length: 18 }, (_, index) => ({
        x: Math.sin(state.time * 0.8 - index * 0.22) * 0.58,
        y: Math.cos(state.time * 0.6 - index * 0.18) * 0.36,
        age: index / 22
      }));
  let draws = 0;

  samples.slice(0, 24).forEach((sample, index) => {
    const k = index / Math.max(samples.length - 1, 1);
    const alpha = Math.max(0, 1 - sample.age * 1.2) * (1 - k * 0.55) * opacityMorph(state);
    const color = index < 3 ? palette.c : index < 12 ? palette.a : palette.b;
    draws += drawTransformed({
      ctx,
      surface,
      drawSurface,
      x: center.x + sample.x * center.x * 0.62,
      y: center.y - sample.y * center.y * 0.56,
      rotation: state.sx * 0.45 + Math.sin(state.time + k * 2) * 0.16,
      scale: scaleForSource(api) * (0.54 - k * 0.3),
      alpha,
      tint: color,
      composite: "screen",
      shadow: palette,
      source: state.source
    });
  });

  return draws;
}

function drawSplit(api: DrawApi): number {
  const { ctx, surface, state, drawSurface } = api;
  const center = canvasCenter(ctx);
  const spread = 12 + Math.abs(state.sx) * 22;
  const base = {
    ctx,
    surface,
    drawSurface,
    y: center.y,
    rotation: state.sx * 0.18,
    scale: scaleForSource(api) * 0.82,
    composite: "screen" as GlobalCompositeOperation,
    alpha: 0.86 * opacityMorph(state)
  };

  return [
    drawTransformed({ ...base, x: center.x - spread, tint: "#ff3b6b", source: state.source }),
    drawTransformed({ ...base, x: center.x + spread, tint: "#3bf0d9", source: state.source }),
    drawTransformed({ ...base, x: center.x, y: center.y + state.sy * 22, tint: "#ffffff", alpha: 0.74 * opacityMorph(state), source: state.source })
  ].reduce((sum, count) => sum + count, 0);
}

function drawGrid(api: DrawApi): number {
  const { ctx, surface, state, drawSurface } = api;
  const palette = palettes[state.paletteName];
  const center = canvasCenter(ctx);
  const cols = 7;
  const rows = 5;
  const gap = Math.min(center.x, center.y) * 0.42;
  let draws = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const dx = col - (cols - 1) / 2;
      const dy = row - (rows - 1) / 2;
      const distance = Math.hypot(dx, dy);
      const phase = state.time * 0.85 - distance * 0.55;
      const pulse = 0.55 + Math.sin(phase) * 0.24;
      const color = (row + col) % 3 === 0 ? palette.a : (row + col) % 3 === 1 ? palette.b : palette.c;
      draws += drawTransformed({
        ctx,
        surface,
        drawSurface,
        x: center.x + dx * gap,
        y: center.y + dy * gap,
        rotation: state.sx * dx * 0.24 + Math.sin(phase * 0.5) * 0.18,
        scale: scaleForSource(api) * (0.18 + pulse * 0.11),
        alpha: (0.44 + pulse * 0.34) * opacityMorph(state),
        tint: color,
        composite: "screen",
        shadow: palette,
        source: state.source
      });
    }
  }

  return draws;
}

function drawTransformed(options: Readonly<{
  ctx: CanvasRenderingContext2D;
  surface: CanvasSurface;
  drawSurface(surface: CanvasSurface): void;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  alpha: number;
  tint: string;
  composite?: GlobalCompositeOperation;
  shadow?: Palette;
  source: AtelierState["source"];
}>): number {
  const { ctx, surface, drawSurface, x, y, rotation, scale, alpha, tint, composite, shadow, source } = options;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  clipSourceMaterial(ctx, surface, source);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.globalCompositeOperation = composite ?? "source-over";
  ctx.shadowColor = shadow?.a ?? tint;
  ctx.shadowBlur = shadow ? 7 * shadow.glow : 4;
  // This is the core Prism move: draw the same live DOM surface many times
  // under normal canvas transforms to turn HTML/CSS/SVG into art material.
  drawSurface(surface);
  ctx.restore();
  return 1;
}

function drawConstellation(api: DrawApi, scale: number, alpha: number): number {
  const { ctx, surface, state, drawSurface } = api;
  const palette = palettes[state.paletteName];
  const center = canvasCenter(ctx);
  const count = 12;
  const radiusX = center.x * 0.34;
  const radiusY = center.y * 0.22;
  let draws = 0;

  for (let index = 0; index < count; index += 1) {
    const phase = index / count;
    const angle = phase * Math.PI * 2 + state.time * 0.18;
    draws += drawTransformed({
      ctx,
      surface,
      drawSurface,
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle * 1.7) * radiusY,
      rotation: angle + state.sx * 0.28,
      scale: scale * (0.7 + Math.sin(angle + state.seed) * 0.12),
      alpha: alpha * (0.65 + Math.sin(angle) * 0.2),
      tint: index % 2 === 0 ? palette.a : palette.b,
      composite: "screen",
      shadow: palette,
      source: state.source
    });
  }

  return draws;
}

function canvasCenter(ctx: CanvasRenderingContext2D): Readonly<{ x: number; y: number }> {
  return {
    x: ctx.canvas.width / 2,
    y: ctx.canvas.height / 2
  };
}

function depthFromState(state: AtelierState): number {
  return Math.max(0, Math.min(1, 0.5 + state.sy * 0.5));
}

function opacityMorph(state: AtelierState): number {
  const morph = 1 - Math.pow(1 - Math.max(0, Math.min(1, state.morph)), 3);
  return 0.18 + morph * 0.82;
}

function clipSourceMaterial(ctx: CanvasRenderingContext2D, surface: CanvasSurface, source: AtelierState["source"]): void {
  if (source === "glyph" || source === "type") {
    return;
  }

  const bounds = surface.getBounds();
  const width = bounds.width;
  const height = bounds.height;
  const left = -width / 2;
  const top = -height / 2;
  const radius = Math.min(width, height) / 2;

  if (width > height * 1.25) {
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(width / 2, 0);
    ctx.lineTo(0, height / 2);
    ctx.lineTo(left, 0);
    ctx.closePath();
    ctx.clip();
    return;
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();
}

function scaleForSource(api: DrawApi): number {
  const { ctx, state, metrics } = api;
  const metric = metrics[state.source];
  const devicePixelRatio = ctx.canvas.width / Math.max(ctx.canvas.clientWidth, 1);
  const sourcePixels = Math.max(metric.width, metric.height) * devicePixelRatio;
  const targetPixels = Math.min(ctx.canvas.width, ctx.canvas.height) * targetFractionForSource(state.source);
  return targetPixels / sourcePixels;
}

function targetFractionForSource(source: AtelierState["source"]): number {
  switch (source) {
    case "type":
      return 0.44;
    case "glyph":
      return 0.28;
    case "css":
      return 0.3;
    case "pattern":
      return 0.32;
  }
}
