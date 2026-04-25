import type { LonLat } from "./types";

export type AtlanticProjection = Readonly<{
  width: number;
  height: number;
  project(lon: number, lat: number): Readonly<{ x: number; y: number }>;
}>;

const VIEW = {
  lonMin: -100,
  lonMax: 5,
  latMin: 4,
  latMax: 64
} as const;

// A restrained equirectangular projection is enough for this example: the
// basemap is contextual, and the important contract is stable CSS-pixel geometry.
export function createAtlanticProjection(
  width: number,
  height: number
): AtlanticProjection {
  return {
    width,
    height,
    project(lon, lat) {
      const u = (lon - VIEW.lonMin) / (VIEW.lonMax - VIEW.lonMin);
      const v = 1 - (lat - VIEW.latMin) / (VIEW.latMax - VIEW.latMin);
      const padX = 0.04;
      const padY = 0.06;

      return {
        x: (padX + u * (1 - padX * 2)) * width,
        y: (padY + v * (1 - padY * 2)) * height
      };
    }
  };
}

export function projectLine(
  line: readonly LonLat[],
  projection: AtlanticProjection
): readonly Readonly<{ x: number; y: number }>[] {
  return line.map(([lon, lat]) => projection.project(lon, lat));
}

export const projectionView = VIEW;
