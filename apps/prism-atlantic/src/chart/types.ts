export type Category = 0 | 1 | 2 | 3 | 4 | 5;

export type LonLat = readonly [lon: number, lat: number];

export type StormPoint = Readonly<{
  timestamp: string;
  lon: number;
  lat: number;
  windKnots: number;
  pressureMb: number | null;
  cat: Category;
  status: string;
  recordIdentifier: string;
}>;

export type StormTrack = Readonly<{
  id: number;
  stormId: string;
  name: string;
  year: number;
  maxWindKnots: number;
  minPressureMb: number | null;
  maxCategory: Category;
  firstTimestamp: string;
  lastTimestamp: string;
  durationDays: number;
  points: readonly StormPoint[];
}>;

export type StormMeta = Readonly<{
  basin: string;
  yearStart: number;
  yearEnd: number;
  storms: number;
}>;

export type ProjectedPoint = StormPoint &
  Readonly<{
    x: number;
    y: number;
  }>;

export type ProjectedTrack = Readonly<{
  track: StormTrack;
  points: readonly ProjectedPoint[];
  maxCategory: Category;
}>;

export type HitResult = Readonly<{
  track: ProjectedTrack;
  point: ProjectedPoint;
  index: number;
  distanceSquared: number;
}>;

export type ChartState = {
  activeFilter: Category | null;
  hoveredTrack: ProjectedTrack | null;
  selectedTrack: ProjectedTrack | null;
  tooltipPoint: Readonly<{ x: number; y: number }> | null;
  exporting: boolean;
};
