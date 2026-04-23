import type { EngineSystem, FrameTime } from "./types";

/**
 * Schedules a callback for the next animation frame.
 */
export type Raf = (callback: FrameRequestCallback) => number;

/**
 * Cancels a scheduled animation frame.
 */
export type Caf = (handle: number) => void;

/**
 * Configures a frame loop.
 */
export type FrameLoopOptions = Readonly<{
  /**
   * Custom frame scheduler for tests or non-browser hosts.
   */
  requestAnimationFrame?: Raf;

  /**
   * Custom frame cancellation function.
   */
  cancelAnimationFrame?: Caf;

  /**
   * Maximum frame delta in seconds.
   */
  maxDelta?: number;
}>;

/**
 * Runs update and render phases for registered systems.
 *
 * @remarks
 * `FrameLoop` is intentionally small and browser-oriented. Higher-level
 * runtimes compose it rather than inheriting from it.
 */
export class FrameLoop {
  private readonly systems: EngineSystem[] = [];
  private readonly requestFrame: Raf;
  private readonly cancelFrame: Caf;
  private readonly maxDelta: number;
  private frameHandle: number | null = null;
  private lastTime = 0;
  private frame = 0;

  /**
   * Creates a frame loop.
   *
   * @param options - Optional scheduler and timing configuration.
   */
  constructor(options: FrameLoopOptions = {}) {
    this.requestFrame =
      options.requestAnimationFrame ??
      ((callback) => globalThis.requestAnimationFrame(callback));
    this.cancelFrame =
      options.cancelAnimationFrame ??
      ((handle) => globalThis.cancelAnimationFrame(handle));
    this.maxDelta = options.maxDelta ?? 1 / 20;
  }

  /**
   * Adds a system to the loop.
   *
   * @param system - System called during loop lifecycle and frame phases.
   */
  addSystem(system: EngineSystem): void {
    this.systems.push(system);
  }

  /**
   * Starts the loop.
   */
  start(): void {
    if (this.frameHandle !== null) {
      return;
    }

    this.lastTime = performance.now();
    for (const system of this.systems) {
      system.start?.();
    }
    this.frameHandle = this.requestFrame(this.tick);
  }

  /**
   * Stops the loop.
   */
  stop(): void {
    if (this.frameHandle === null) {
      return;
    }

    this.cancelFrame(this.frameHandle);
    this.frameHandle = null;
    for (const system of [...this.systems].reverse()) {
      system.stop?.();
    }
  }

  private readonly tick = (nowMs: number): void => {
    const now = nowMs / 1000;
    const previous = this.lastTime / 1000;
    const delta = Math.min(now - previous, this.maxDelta);
    this.lastTime = nowMs;
    this.frame += 1;

    const time: FrameTime = { now, delta, frame: this.frame };
    for (const system of this.systems) {
      system.update?.(time);
    }
    for (const system of this.systems) {
      system.render?.(time);
    }

    this.frameHandle = this.requestFrame(this.tick);
  };
}
