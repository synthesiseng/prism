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
  const { state } = api;
  const palette = palettes[state.paletteName];
  const layers = 14 + Math.round(depthFromState(state) * 14);
  const dx = state.sx * 26;
  const dy = state.sy * 18;
  const angle = state.sx * 18 + Math.sin(state.time * 0.6) * 1.5;
  const baseScale = 0.78 + depthFromState(state) * 0.12;
  let draws = 0;

  for (let index = layers; index >= 0; index -= 1) {
    const k = index / layers;
    const offset = Math.pow(k, 1.05);
    const x = dx * offset;
    const y = dy * offset;
    const alpha = (1 - k * 0.55) * (0.35 + 0.65 * (1 - k));
    const rotation = angle * (1 - k * 0.3);
    const scale = baseScale * (1 - k * 0.18);
    const color = index === 0 ? palette.c : index < layers * 0.4 ? palette.a : palette.b;

    if (index < 3) {
      const split = 6 * (3 - index);
      draws += drawWorld(api, x - split, y, rotation, scale, alpha * 0.9, "#ff3b6b", "screen");
      draws += drawWorld(api, x + split, y, rotation, scale, alpha * 0.9, "#3bf0d9", "screen");
    }

    draws += drawWorld(api, x, y, rotation, scale, alpha, color);
  }

  return draws;
}

function drawOrbit(api: DrawApi): number {
  const { state } = api;
  const palette = palettes[state.paletteName];
  const depth = depthFromState(state);
  const rings = 3;
  const baseCount = 8 + Math.round(depth * 8);
  const baseRadius = 130 + depth * 90;
  const angleOffset = state.time * 0.6 + state.sx * 90;
  const tilt = state.sy * 22;
  let draws = 0;

  draws += drawWorld(api, 0, 0, angleOffset * 0.3, 0.4 + depth * 0.1, 0.95, palette.c);

  for (let ring = 0; ring < rings; ring += 1) {
    const count = baseCount + ring * 4;
    const radius = baseRadius + ring * 80;
    const scale = 0.32 - ring * 0.07;
    const alpha = 0.85 - ring * 0.18;
    const ringRotation = angleOffset * (1 + ring * 0.4) * (ring % 2 === 0 ? 1 : -1);

    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + degreesToRadians(ringRotation);
      const color = ring === 0 ? palette.a : ring === 1 ? palette.b : palette.c;
      draws += drawWorld(
        api,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * (1 - tilt / 120),
        radiansToDegrees(angle) + 90 + ringRotation * 0.2,
        scale,
        alpha,
        color,
        "screen"
      );
    }
  }

  return draws;
}

function drawTrail(api: DrawApi): number {
  const { state } = api;
  const palette = palettes[state.paletteName];
  const echoes = 18;
  const span = 320 + depthFromState(state) * 220;
  const curve = state.sy * 180;
  const angle = state.sx * 30;
  let draws = 0;

  for (let index = echoes; index >= 0; index -= 1) {
    const k = index / echoes;
    const x = (k - 0.5) * span * 0.9 - state.sx * 60;
    const y = Math.sin(k * Math.PI) * curve - state.sy * 30;
    const scale = 0.52 - k * 0.32;
    const rotation = angle * (1 - k) + Math.sin(state.time + k * 3) * 4;
    const alpha = 1 - k * 0.92;
    const color = index === 0 ? palette.c : index < echoes * 0.4 ? palette.a : palette.b;
    draws += drawWorld(api, x, y, rotation, scale, alpha, color, "screen");
  }

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
    scale: drawScale(api, 0.82),
    composite: "screen" as GlobalCompositeOperation,
    alpha: 0.68 * opacityMorph(state)
  };

  return [
    drawTransformed({ ...base, x: center.x - spread, tint: "#ff3b6b" }),
    drawTransformed({ ...base, x: center.x + spread, tint: "#3bf0d9" }),
    drawTransformed({ ...base, x: center.x, y: center.y + state.sy * 22, tint: "#ffffff", alpha: 0.62 * opacityMorph(state) })
  ].reduce((sum, count) => sum + count, 0);
}

function drawGrid(api: DrawApi): number {
  const { ctx, surface, state, drawSurface } = api;
  const palette = palettes[state.paletteName];
  const center = canvasCenter(ctx);
  const cols = 7;
  const rows = 5;
  const gap = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.13;
  const xOffset = -((cols - 1) / 2) * gap;
  const yOffset = -((rows - 1) / 2) * gap;
  const skew = state.sx * 0.24;
  const wave = state.sy * 0.5;
  const random = mulberry32(state.seed);
  let draws = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const dx = col - (cols - 1) / 2;
      const dy = row - (rows - 1) / 2;
      const distance = Math.hypot(dx, dy);
      const phase = state.time * 0.8 - distance * 0.6;
      const pulse = 0.45 + 0.55 * (Math.sin(phase) * 0.5 + 0.5);
      const pick = random();
      const color = pick < 0.34 ? palette.a : pick < 0.67 ? palette.b : palette.c;
      const scale = 0.18 + pulse * 0.18 + wave * (1 - distance / 4);
      draws += drawTransformed({
        ctx,
        surface,
        drawSurface,
        x: center.x + xOffset + col * gap,
        y: center.y + yOffset + row * gap,
        rotation: skew * dx + Math.sin(phase * 0.5) * 0.21,
        scale: drawScale(api, Math.max(0.12, scale)),
        alpha: (0.55 + pulse * 0.45) * opacityMorph(state),
        tint: color,
        composite: "screen",
        shadow: palette
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
}>): number {
  const { ctx, surface, drawSurface, x, y, rotation, scale, alpha, tint, composite, shadow } = options;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.globalCompositeOperation = composite ?? "source-over";
  ctx.shadowColor = tint;
  ctx.shadowBlur = shadow ? 1.1 * shadow.glow : 0.8;
  surface.element.style.color = tint;
  // This is the core Prism move: draw the same live DOM surface many times
  // under normal canvas transforms to turn HTML/CSS/SVG into art material.
  drawSurface(surface);
  ctx.restore();
  return 1;
}

function drawWorld(
  api: DrawApi,
  x: number,
  y: number,
  rotation: number,
  scale: number,
  alpha: number,
  tint: string,
  composite?: GlobalCompositeOperation
): number {
  const { ctx, state } = api;
  const center = canvasCenter(ctx);
  const globalScale = (0.8 + 0.2 * opacityMorph(state)) * (1 + Math.sin(state.time * 0.9) * 0.012);
  const options = {
    ...api,
    x: center.x + x * stageScale(ctx) * globalScale,
    y: center.y + y * stageScale(ctx) * globalScale,
    rotation: degreesToRadians(rotation),
    scale: drawScale(api, scale * globalScale),
    alpha: alpha * (0.15 + 0.85 * opacityMorph(state)),
    tint
  };

  return composite
    ? drawTransformed({ ...options, composite })
    : drawTransformed(options);
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

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawScale(api: DrawApi, scale: number): number {
  return scale * stageScale(api.ctx) / devicePixelRatio(api.ctx);
}

function stageScale(ctx: CanvasRenderingContext2D): number {
  return Math.min(ctx.canvas.width, ctx.canvas.height) / 1000;
}

function devicePixelRatio(ctx: CanvasRenderingContext2D): number {
  return ctx.canvas.width / Math.max(ctx.canvas.clientWidth, 1);
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}
