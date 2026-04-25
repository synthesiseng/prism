import "./styles.css";
import { createAtlanticProjection } from "./chart/projection";
import { nearestStormPoint } from "./chart/hitTest";
import { renderAtlanticChart } from "./chart/render";
import type { Category, ProjectedTrack, StormTrack } from "./chart/types";
import { coastlines } from "./data/coastlines";
import { stormMeta, stormTracks } from "./data/storms";
import { exportRuntimePng } from "./prism/export";
import { createAtlanticRuntime } from "./prism/runtime";
import { registerAtlanticSurfaces } from "./prism/surfaces";
import { createInitialChartState } from "./ui/state";
import {
  drawAtlanticSurfaces,
  getAtlanticUiElements,
  updateDetailPanel,
  updateExportState,
  updateOverview,
  updateSurfaceBounds,
  updateTooltip
} from "./ui/surfaces";

const canvas = getCanvas("viz");
const runtime = createAtlanticRuntime(canvas);
const surfaces = registerAtlanticSurfaces(runtime);
const elements = getAtlanticUiElements();
const state = createInitialChartState();
const nativeGate = document.getElementById("native-gate");

// Prism owns the HTML-in-Canvas lifecycle: runtime creation, surface
// registration, invalidation, paint readiness, and cleanup. Atlantic owns the
// storm data, projection, interaction state, and the canvas chart drawing.
if (nativeGate) {
  nativeGate.hidden = runtime.backendKind === "native";
}

let projectedTracks: readonly ProjectedTrack[] = [];
let projectedWidth = -1;
let projectedHeight = -1;

updateOverview(stormMeta, countByCategory(stormTracks));
bindInteractions();

runtime.onPaint(({ ctx, drawSurface }) => {
  const width = runtime.width;
  const height = runtime.height;
  if (width <= 0 || height <= 0) {
    return;
  }

  projectedTracks = getProjectedTracks(width, height);
  updateTooltip(state);
  updateDetailPanel(state);
  updateExportState(state);
  updateSurfaceBounds(runtime, surfaces, state);

  // Prism exposes CSS-space surface bounds. The chart also uses CSS-space math,
  // so the canvas context is scaled through the runtime's current pixel ratio.
  ctx.save();
  ctx.scale(runtime.pixelRatio, runtime.pixelRatio);
  renderAtlanticChart({
    ctx,
    width,
    height,
    projection: createAtlanticProjection(width, height),
    coastlines,
    tracks: projectedTracks,
    state
  });
  ctx.restore();

  drawAtlanticSurfaces(drawSurface, surfaces, state);
});

runtime.start();

function bindInteractions(): void {
  canvas.addEventListener("mousemove", (event) => {
    // Pointer input stays in CSS pixels. Prism centralizes the client-to-canvas
    // conversion so the app never multiplies by devicePixelRatio directly.
    const point = runtime.clientToCanvasPoint(event.clientX, event.clientY);
    const hit = nearestStormPoint(projectedTracks, point, state.activeFilter);
    const nextHover = hit?.track ?? null;

    state.tooltipPoint = hit ? point : null;
    state.hoveredTrack = nextHover;
    canvas.style.cursor = hit ? "pointer" : "crosshair";
    runtime.invalidate();
  });

  canvas.addEventListener("mouseleave", () => {
    state.hoveredTrack = null;
    state.tooltipPoint = null;
    canvas.style.cursor = "crosshair";
    runtime.invalidate();
  });

  canvas.addEventListener("click", (event) => {
    // Selection uses the same CSS-space hit testing as hover, which keeps
    // interaction stable across DPR and canvas resize changes.
    const point = runtime.clientToCanvasPoint(event.clientX, event.clientY);
    const hit = nearestStormPoint(projectedTracks, point, state.activeFilter);
    state.selectedTrack = hit?.track ?? null;
    runtime.invalidate();
  });

  elements.panelClose.addEventListener("click", (event) => {
    event.stopPropagation();
    state.selectedTrack = null;
    runtime.invalidate();
  });

  for (const item of elements.legendItems) {
    item.addEventListener("mouseenter", () => {
      state.activeFilter = parseCategory(item.dataset.cat);
      runtime.invalidate();
    });
    item.addEventListener("focus", () => {
      state.activeFilter = parseCategory(item.dataset.cat);
      runtime.invalidate();
    });
    item.addEventListener("mouseleave", () => {
      state.activeFilter = null;
      runtime.invalidate();
    });
    item.addEventListener("blur", () => {
      state.activeFilter = null;
      runtime.invalidate();
    });
  }

  elements.exportButton.addEventListener("click", () => {
    void exportPng();
  });
}

function getProjectedTracks(width: number, height: number): readonly ProjectedTrack[] {
  if (width === projectedWidth && height === projectedHeight) {
    return projectedTracks;
  }

  // Projection is cached by the runtime's CSS-pixel dimensions. A DPR-only
  // backing-store change should not alter the app's geographic layout.
  const projection = createAtlanticProjection(width, height);
  projectedWidth = width;
  projectedHeight = height;
  projectedTracks = stormTracks.map((track) => ({
    track,
    maxCategory: track.maxCategory,
    points: track.points.map((point) => ({
      ...point,
      ...projection.project(point.lon, point.lat)
    }))
  }));

  return projectedTracks;
}

async function exportPng(): Promise<void> {
  if (state.exporting) {
    return;
  }

  state.exporting = true;
  runtime.invalidate();
  try {
    await exportRuntimePng(
      runtime,
      `prism-atlantic_${new Date().toISOString().slice(0, 10)}.png`
    );
  } catch (error) {
    console.error("Prism Atlantic export failed", error);
  } finally {
    state.exporting = false;
    runtime.invalidate();
  }
}

function countByCategory(tracks: readonly StormTrack[]): readonly number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const track of tracks) {
    counts[track.maxCategory] = (counts[track.maxCategory] ?? 0) + 1;
  }
  return counts;
}

function parseCategory(value: string | undefined): Category | null {
  if (value === undefined) {
    return null;
  }
  const category = Number(value);
  return category >= 0 && category <= 5 ? (category as Category) : null;
}

function getCanvas(id: string): HTMLCanvasElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`#${id} must be a canvas element.`);
  }
  return element;
}
