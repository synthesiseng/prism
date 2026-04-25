import type { HitResult, ProjectedTrack } from "./types";

// Hit testing happens after projection, so the radius is intentionally in CSS
// pixels instead of geographic units or backing-store pixels.
const HIT_RADIUS_CSS = 14;

export function nearestStormPoint(
  tracks: readonly ProjectedTrack[],
  point: Readonly<{ x: number; y: number }>,
  activeFilter: number | null
): HitResult | null {
  let best: HitResult | null = null;
  const maxDistanceSquared = HIT_RADIUS_CSS * HIT_RADIUS_CSS;

  for (const track of tracks) {
    if (activeFilter !== null && track.maxCategory !== activeFilter) {
      continue;
    }

    for (let index = 0; index < track.points.length; index += 1) {
      const candidate = track.points[index];
      if (!candidate) {
        continue;
      }
      const dx = candidate.x - point.x;
      const dy = candidate.y - point.y;
      const distanceSquared = dx * dx + dy * dy;

      if (
        distanceSquared < maxDistanceSquared &&
        (!best || distanceSquared < best.distanceSquared)
      ) {
        best = {
          track,
          point: candidate,
          index,
          distanceSquared
        };
      }
    }
  }

  return best;
}
