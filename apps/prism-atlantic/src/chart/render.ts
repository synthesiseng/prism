import type { AtlanticProjection } from "./projection";
import { projectionView } from "./projection";
import type { Category, ChartState, LonLat, ProjectedTrack } from "./types";

export const categoryHex: Record<Category, string> = {
  0: "#4dd9c0",
  1: "#4dd9c0",
  2: "#f5a623",
  3: "#f5a623",
  4: "#ff6b6b",
  5: "#ff2d55"
};

export const categoryLabel: Record<Category, string> = {
  0: "TS",
  1: "C1",
  2: "C2",
  3: "C3",
  4: "C4",
  5: "C5"
};

type CategoryStyle = Readonly<{
  core: string;
  bloom: string;
  alphaCore: number;
  alphaBloom: number;
  widthCore: number;
  widthBloom: number;
}>;

const categoryStyle: Record<Category, CategoryStyle> = {
  0: {
    core: "#9ff0dd",
    bloom: "#4dd9c0",
    alphaCore: 0.55,
    alphaBloom: 0.05,
    widthCore: 0.6,
    widthBloom: 3.5
  },
  1: {
    core: "#9ff0dd",
    bloom: "#4dd9c0",
    alphaCore: 0.65,
    alphaBloom: 0.07,
    widthCore: 0.7,
    widthBloom: 4.5
  },
  2: {
    core: "#ffd28a",
    bloom: "#f5a623",
    alphaCore: 0.72,
    alphaBloom: 0.09,
    widthCore: 0.85,
    widthBloom: 5.5
  },
  3: {
    core: "#ffd28a",
    bloom: "#f5a623",
    alphaCore: 0.82,
    alphaBloom: 0.13,
    widthCore: 1.1,
    widthBloom: 8
  },
  4: {
    core: "#ffb0b0",
    bloom: "#ff6b6b",
    alphaCore: 0.92,
    alphaBloom: 0.18,
    widthCore: 1.4,
    widthBloom: 11.5
  },
  5: {
    core: "#ffe0e4",
    bloom: "#ff2d55",
    alphaCore: 1,
    alphaBloom: 0.24,
    widthCore: 1.85,
    widthBloom: 16
  }
};

export function renderAtlanticChart(options: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  projection: AtlanticProjection;
  coastlines: readonly (readonly LonLat[])[];
  tracks: readonly ProjectedTrack[];
  state: ChartState;
}): void {
  const { ctx, width, height, projection, coastlines, tracks, state } = options;

  ctx.clearRect(0, 0, width, height);
  drawOcean(ctx, width, height);
  drawCoastlines(ctx, projection, coastlines);

  // Lower-intensity tracks draw first, then selected/hovered tracks move to the
  // end so interaction reads as z-order without changing the underlying data.
  const order = tracks.slice().sort((a, b) => a.maxCategory - b.maxCategory);
  moveTrackToEnd(order, state.selectedTrack);
  moveTrackToEnd(order, state.hoveredTrack);

  // Separate passes keep thousands of real storm segments legible: a soft bloom
  // pass for density, a mid pass for structure, and a core pass for the track.
  for (const track of order) {
    drawTrackPass(ctx, track, state, "bloom");
  }
  for (const track of order) {
    drawTrackPass(ctx, track, state, "mid");
  }
  for (const track of order) {
    drawTrackPass(ctx, track, state, "core");
  }
  for (const track of order) {
    drawOriginDot(ctx, track, state);
    drawEndpointDissipation(ctx, track, state);
  }
}

function drawOcean(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Export only contains canvas pixels, not CSS backgrounds from #stage. Paint an
  // opaque base first so PNG output matches the on-screen Atlantic scene.
  ctx.fillStyle = "#050a12";
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(
    width * 0.42,
    height * 0.48,
    20,
    width * 0.44,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  gradient.addColorStop(0, "rgba(20, 50, 70, 0.16)");
  gradient.addColorStop(0.62, "rgba(8, 20, 34, 0.05)");
  gradient.addColorStop(1, "rgba(5, 10, 18, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawCoastlines(
  ctx: CanvasRenderingContext2D,
  projection: AtlanticProjection,
  coastlines: readonly (readonly LonLat[])[]
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 0.85;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const line of coastlines) {
    ctx.beginPath();
    line.forEach(([lon, lat], index) => {
      const point = projection.project(lon, lat);
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([1, 3]);

  for (let lat = 15; lat <= 60; lat += 15) {
    const start = projection.project(projectionView.lonMin, lat);
    const end = projection.project(projectionView.lonMax, lat);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  for (let lon = -90; lon <= 0; lon += 15) {
    const start = projection.project(lon, projectionView.latMin);
    const end = projection.project(lon, projectionView.latMax);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTrackPass(
  ctx: CanvasRenderingContext2D,
  track: ProjectedTrack,
  state: ChartState,
  pass: "bloom" | "mid" | "core"
): void {
  if (track.points.length < 2) {
    return;
  }

  const dim = dimFactorFor(track, state);
  const bright = brightFactorFor(track, state);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = pass === "core" ? "source-over" : "lighter";

  for (let index = 1; index < track.points.length; index += 1) {
    const start = track.points[index - 1];
    const end = track.points[index];
    if (!start || !end) {
      continue;
    }
    const style = colorForWind((start.windKnots + end.windKnots) / 2);
    const tEnd = index / (track.points.length - 1);
    const tStart = (index - 1) / (track.points.length - 1);
    // Tapering reduces hard endpoints on six-hour HURDAT2 samples and makes
    // short-lived storms read as paths instead of chunky polylines.
    const taper =
      (Math.min(1, Math.sin(Math.PI * tEnd) ** 0.55) +
        Math.min(1, Math.sin(Math.PI * tStart) ** 0.55)) /
      2;

    const width =
      pass === "bloom"
        ? style.widthBloom * taper * bright
        : pass === "mid"
          ? style.widthBloom * 0.45 * taper * bright
          : style.widthCore * taper * bright;
    const alpha =
      pass === "bloom"
        ? style.alphaBloom * dim * bright
        : pass === "mid"
          ? (style.alphaBloom + 0.18) * dim * bright
          : style.alphaCore * dim * bright;
    const color = pass === "core" ? style.core : style.bloom;

    if (alpha < 0.005 || width < 0.05) {
      continue;
    }

    ctx.strokeStyle = hexAlpha(color, Math.min(1, alpha));
    ctx.lineWidth = Math.max(0.05, width);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawOriginDot(
  ctx: CanvasRenderingContext2D,
  track: ProjectedTrack,
  state: ChartState
): void {
  const point = track.points[0];
  if (!point) {
    return;
  }
  const style = categoryStyle[track.maxCategory];
  const dim = dimFactorFor(track, state);
  const bright = brightFactorFor(track, state);
  const radius = 2.5 + track.maxCategory * 0.5;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(
    point.x,
    point.y,
    0,
    point.x,
    point.y,
    radius * 2.4
  );
  glow.addColorStop(0, hexAlpha(style.bloom, 0.06 * dim * bright));
  glow.addColorStop(1, hexAlpha(style.bloom, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = hexAlpha(style.core, Math.min(1, 0.85 * dim * bright));
  ctx.beginPath();
  ctx.arc(point.x, point.y, 0.9 + track.maxCategory * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEndpointDissipation(
  ctx: CanvasRenderingContext2D,
  track: ProjectedTrack,
  state: ChartState
): void {
  const point = track.points[track.points.length - 1];
  if (!point) {
    return;
  }
  const style = categoryStyle[point.cat];
  const dim = dimFactorFor(track, state);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 6);
  glow.addColorStop(0, hexAlpha(style.bloom, 0.08 * dim));
  glow.addColorStop(1, hexAlpha(style.bloom, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function colorForWind(wind: number): CategoryStyle {
  if (wind >= 137) return categoryStyle[5];
  if (wind >= 113) return categoryStyle[4];
  if (wind >= 96) return categoryStyle[3];
  if (wind >= 83) return categoryStyle[2];
  if (wind >= 64) return categoryStyle[1];
  return categoryStyle[0];
}

function dimFactorFor(track: ProjectedTrack, state: ChartState): number {
  let factor = 1;
  if (state.activeFilter !== null) {
    factor *= track.maxCategory === state.activeFilter ? 1.15 : 0.18;
  }
  if (state.hoveredTrack && state.hoveredTrack !== track) {
    factor *= 0.55;
  }
  if (state.selectedTrack && state.selectedTrack !== track) {
    factor *= 0.65;
  }
  return factor;
}

function brightFactorFor(track: ProjectedTrack, state: ChartState): number {
  if (state.hoveredTrack === track) return 1.25;
  if (state.selectedTrack === track) return 1.15;
  return 1;
}

function moveTrackToEnd(order: ProjectedTrack[], track: ProjectedTrack | null): void {
  if (!track) {
    return;
  }
  const index = order.indexOf(track);
  if (index >= 0) {
    order.splice(index, 1);
    order.push(track);
  }
}

function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${String(red)},${String(green)},${String(blue)},${String(alpha)})`;
}
