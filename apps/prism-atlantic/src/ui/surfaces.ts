import type { CanvasRuntime } from "@synthesisengineering/prism";
import type { AtlanticSurfaces } from "../prism/surfaces";
import { categoryHex, categoryLabel } from "../chart/render";
import type { ChartState, ProjectedTrack, StormMeta } from "../chart/types";

// UI code owns DOM content and CSS-pixel layout decisions. Prism owns when and
// how these same DOM nodes are painted into the canvas.
export type AtlanticUiElements = Readonly<{
  exportButton: HTMLButtonElement;
  exportLabel: HTMLElement;
  panelClose: HTMLButtonElement;
  legendItems: readonly HTMLElement[];
}>;

export function getAtlanticUiElements(): AtlanticUiElements {
  return {
    exportButton: getButton("export"),
    exportLabel: getElement("export-label"),
    panelClose: getButton("panel-x"),
    legendItems: Array.from(document.querySelectorAll<HTMLElement>("#legend li"))
  };
}

export function updateOverview(meta: StormMeta, counts: readonly number[]): void {
  setText("m-total", meta.storms.toLocaleString());
  setText(
    "m-major",
    counts
      .slice(3)
      .reduce((sum, count) => sum + count, 0)
      .toLocaleString()
  );
  setText("m-cat5", (counts[5] ?? 0).toLocaleString());
  setText(
    "m-visible",
    `${String(meta.storms).padStart(3, "0")} / ${String(meta.storms)}`
  );

  counts.forEach((count, index) => {
    setText(`c${String(index)}`, String(count).padStart(2, "0"));
  });
}

export function updateTooltip(state: ChartState): void {
  const tooltip = getElement("tooltip");
  const hovered = state.hoveredTrack;
  const point = state.tooltipPoint;

  if (!hovered || !point) {
    tooltip.classList.remove("show");
    return;
  }

  let nearest = hovered.points[0];
  for (const candidate of hovered.points) {
    if (!nearest) {
      nearest = candidate;
      continue;
    }
    const bestDistance = (nearest.x - point.x) ** 2 + (nearest.y - point.y) ** 2;
    const candidateDistance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
    if (candidateDistance < bestDistance) {
      nearest = candidate;
    }
  }
  if (!nearest) {
    tooltip.classList.remove("show");
    return;
  }
  const badge = getElement("tt-badge");

  setText("tt-name", hovered.track.name);
  badge.textContent = categoryLabel[nearest.cat];
  badge.style.background = categoryHex[nearest.cat];
  setText("tt-wind", `${String(Math.round(nearest.windKnots))} kt`);
  setText("tt-date", formatDate(nearest.timestamp));
  setText("tt-pos", formatPosition(nearest.lon, nearest.lat));
  setText("tt-season", String(hovered.track.year));
  tooltip.classList.add("show");
}

export function updateDetailPanel(state: ChartState): void {
  const panel = getElement("panel");
  const selected = state.selectedTrack;

  if (!selected) {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    return;
  }

  const track = selected.track;
  const badge = getElement("p-badge");
  const category = track.maxCategory;

  setText("p-name", track.name);
  setText("p-eyebrow", `North Atlantic · ${String(track.year)} Season`);
  setText(
    "p-season",
    `${formatDate(track.firstTimestamp)} → ${formatDate(track.lastTimestamp)}`
  );
  badge.textContent = category === 0 ? "Tropical Storm" : `Category ${String(category)}`;
  badge.style.background = categoryHex[category];
  setText("p-wind", String(track.maxWindKnots));
  setText("p-dur", track.durationDays.toFixed(1));
  setText("p-len", Math.round(trackLengthNm(selected)).toLocaleString());
  setText("p-cat", category === 0 ? "Tropical Storm" : `Category ${String(category)}`);
  setText("p-tl-peak", `${String(track.maxWindKnots)} kt peak`);
  setText("p-tl-start", formatDate(track.firstTimestamp));
  setText("p-tl-end", formatDate(track.lastTimestamp));
  updateTimeline(selected);
  updatePressure(track.minPressureMb);
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
}

export function updateExportState(state: ChartState): void {
  const button = getButton("export");
  const label = getElement("export-label");
  button.classList.toggle("busy", state.exporting);
  button.disabled = state.exporting;
  label.textContent = state.exporting ? "Rendering..." : "Export PNG";
}

export function updateSurfaceBounds(
  runtime: CanvasRuntime,
  surfaces: AtlanticSurfaces,
  state: ChartState
): void {
  const width = runtime.width;
  const height = runtime.height;
  const tooltipSize = measure(surfaces.tooltip.element, 200, 90);
  const detailSize = measure(surfaces.detail.element, 300, 520);

  // Bounds are recomputed per paint because HTML content can change size
  // independently of the canvas chart. The values passed to Prism stay in CSS pixels.
  surfaces.brand.setBounds(centered(width, 28, measure(surfaces.brand.element, 430, 48)));
  surfaces.overview.setBounds({
    x: 28,
    y: 28,
    width: 280,
    height: measure(surfaces.overview.element, 280, 180).height
  });
  surfaces.legend.setBounds({
    x: 28,
    y: height - 28 - measure(surfaces.legend.element, 220, 235).height,
    width: 220,
    height: measure(surfaces.legend.element, 220, 235).height
  });
  surfaces.exportButton.setBounds({
    x: width - 28 - measure(surfaces.exportButton.element, 132, 34).width,
    y: 28,
    width: measure(surfaces.exportButton.element, 132, 34).width,
    height: 34
  });
  surfaces.caption.setBounds({
    x: width - 28 - measure(surfaces.caption.element, 250, 42).width,
    y: height - 28 - 42,
    width: measure(surfaces.caption.element, 250, 42).width,
    height: 42
  });

  if (state.tooltipPoint) {
    const x =
      state.tooltipPoint.x + tooltipSize.width + 40 > width
        ? state.tooltipPoint.x - tooltipSize.width - 16
        : state.tooltipPoint.x + 16;
    const y = Math.min(
      Math.max(state.tooltipPoint.y - tooltipSize.height / 2, 12),
      height - tooltipSize.height - 12
    );
    surfaces.tooltip.setBounds({
      x,
      y,
      width: tooltipSize.width,
      height: tooltipSize.height
    });
  }

  surfaces.detail.setBounds({
    x: width - 28 - detailSize.width,
    y: 82,
    width: detailSize.width,
    height: detailSize.height
  });
}

export function drawAtlanticSurfaces(
  drawSurface: (surface: AtlanticSurfaces[keyof AtlanticSurfaces]) => void,
  surfaces: AtlanticSurfaces,
  state: ChartState
): void {
  // Surface draw order is the composition order: chart first in main.ts, then
  // persistent UI, then transient tooltip/detail surfaces.
  drawSurface(surfaces.brand);
  drawSurface(surfaces.overview);
  drawSurface(surfaces.legend);
  drawSurface(surfaces.caption);
  drawSurface(surfaces.exportButton);
  if (state.hoveredTrack) {
    drawSurface(surfaces.tooltip);
  }
  if (state.selectedTrack) {
    drawSurface(surfaces.detail);
  }
}

function updateTimeline(track: ProjectedTrack): void {
  const svg = getElement("p-tl");
  const width = 240;
  const height = 60;
  const padding = 4;
  const winds = track.points.map((point) => point.windKnots);
  const maxWind = Math.max(...winds, 80);
  const peak = track.track.maxCategory;
  // The SVG sparkline remains normal HTML surface content. It summarizes the
  // real HURDAT2 wind samples, then Prism composes the panel into the canvas.
  const points = winds.map((wind, index) => {
    const x = padding + (index / Math.max(1, winds.length - 1)) * (width - padding * 2);
    const y = height - padding - (wind / maxWind) * (height - padding * 2);
    return { x, y, wind };
  });
  if (points.length === 0) {
    svg.textContent = "";
    return;
  }
  const line = points
    .map(
      (point, index) => `${index === 0 ? "M" : "L"} ${String(point.x)} ${String(point.y)}`
    )
    .join(" ");
  const area = `M ${String(padding)} ${String(height - padding)} ${points.map((point) => `L ${String(point.x)} ${String(point.y)}`).join(" ")} L ${String(width - padding)} ${String(height - padding)} Z`;
  const peakIndex = points.reduce(
    (best, point, index) => (point.wind > (points[best]?.wind ?? 0) ? index : best),
    0
  );
  const peakPoint = points[peakIndex];
  if (!peakPoint) {
    svg.textContent = "";
    return;
  }
  const bands = [64, 83, 96, 113, 137]
    .filter((wind) => wind < maxWind)
    .map((wind) => {
      const y = height - padding - (wind / maxWind) * (height - padding * 2);
      return `<line x1="${String(padding)}" x2="${String(width - padding)}" y1="${String(y)}" y2="${String(y)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2 3"/>`;
    })
    .join("");

  svg.innerHTML = `<defs><linearGradient id="tl-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${categoryHex[peak]}" stop-opacity="0.6"/><stop offset="100%" stop-color="${categoryHex[peak]}" stop-opacity="0"/></linearGradient></defs>${bands}<path d="${area}" fill="url(#tl-grad)"/><path d="${line}" fill="none" stroke="${categoryHex[peak]}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${String(peakPoint.x)}" cy="${String(peakPoint.y)}" r="2.5" fill="${categoryHex[peak]}"/><circle cx="${String(peakPoint.x)}" cy="${String(peakPoint.y)}" r="5" fill="${categoryHex[peak]}" opacity="0.25"/>`;
}

function updatePressure(pressure: number | null): void {
  const landfalls = getElement("p-landfalls");
  landfalls.textContent = "";
  const value = document.createElement("span");
  value.className = pressure === null ? "none" : "chip";
  value.textContent =
    pressure === null
      ? "Minimum pressure unavailable in HURDAT2 row data"
      : `${String(pressure)} mb minimum pressure`;
  landfalls.append(value);
}

function trackLengthNm(track: ProjectedTrack): number {
  let km = 0;
  for (let index = 1; index < track.points.length; index += 1) {
    const start = track.points[index - 1];
    const end = track.points[index];
    if (!start || !end) {
      continue;
    }
    km += haversine(start.lon, start.lat, end.lon, end.lat);
  }
  return km * 0.539957;
}

function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const earthRadiusKm = 6371;
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function centered(
  width: number,
  y: number,
  size: Readonly<{ width: number; height: number }>
) {
  return {
    x: width / 2 - size.width / 2,
    y,
    width: size.width,
    height: size.height
  };
}

function measure(
  element: HTMLElement,
  fallbackWidth: number,
  fallbackHeight: number
): Readonly<{ width: number; height: number }> {
  // Registered surfaces are still live DOM nodes, so their intrinsic layout is
  // available before Prism draws them. Fallbacks prevent zero-sized first paints.
  return {
    width: Math.max(element.offsetWidth, fallbackWidth),
    height: Math.max(element.offsetHeight, fallbackHeight)
  };
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(timestamp));
}

function formatPosition(lon: number, lat: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${ns}  ${Math.abs(lon).toFixed(1)}°${ew}`;
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element;
}

function getButton(id: string): HTMLButtonElement {
  const element = getElement(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`#${id} must be a button.`);
  }
  return element;
}

function setText(id: string, value: string): void {
  getElement(id).textContent = value;
}
