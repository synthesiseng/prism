import type { ChartState } from "../chart/types";

export function createInitialChartState(): ChartState {
  return {
    activeFilter: null,
    hoveredTrack: null,
    selectedTrack: null,
    tooltipPoint: null,
    exporting: false
  };
}
