import rawData from "./hurdat2-atlantic.json";
import type { StormMeta, StormTrack } from "../chart/types";

// Local HURDAT2 snapshot generated from NOAA/NHC source text. The large JSON
// file is ignored by Git, while the source URL and filters remain auditable.
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
