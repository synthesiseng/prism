/**
 * Timing data for one runtime frame.
 */
export type FrameTime = Readonly<{
  /**
   * Current time in seconds.
   */
  now: number;

  /**
   * Clamped time since the previous frame in seconds.
   */
  delta: number;

  /**
   * Monotonic frame counter starting at one.
   */
  frame: number;
}>;

/**
 * Minimal lifecycle contract for frame-driven systems.
 */
export interface EngineSystem {
  /**
   * Called when the owning loop starts.
   */
  start?(): void;

  /**
   * Called when the owning loop stops.
   */
  stop?(): void;

  /**
   * Called before render work for each frame.
   *
   * @param time - Timing data for the current frame.
   */
  update?(time: FrameTime): void;

  /**
   * Called after all update work for each frame.
   *
   * @param time - Timing data for the current frame.
   */
  render?(time: FrameTime): void;
}
