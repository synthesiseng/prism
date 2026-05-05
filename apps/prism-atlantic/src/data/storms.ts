import rawData from "./atlantic-snapshot.json";
import type { StormMeta, StormTrack } from "../chart/types";

// Committed HURDAT2 snapshot generated from NOAA/NHC source text. The full local
// JSON can be regenerated for data work, while this compact 2000-2025 snapshot
// keeps the deployed example deterministic and small enough to ship with Git.
type Hurdat2Snapshot = Readonly<{
  source: Readonly<{
    name: string;
    url: string;
    archive: string;
    snapshot: string;
  }>;
  filters: Readonly<{
    yearStart: number;
    yearEnd: number;
    minimumMaxWindKnots: number;
    viewport: Readonly<{
      lonMin: number;
      lonMax: number;
      latMin: number;
      latMax: number;
    }>;
  }>;
  meta: StormMeta;
  storms: readonly StormTrack[];
}>;

export const hurdat2Snapshot = rawData as Hurdat2Snapshot;
export const stormTracks = hurdat2Snapshot.storms;
export const stormMeta = hurdat2Snapshot.meta;
