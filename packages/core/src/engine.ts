import { FrameLoop, type FrameLoopOptions } from "./frame-loop";
import type { EngineSystem } from "./types";

/**
 * Composes frame-driven systems behind a single lifecycle.
 *
 * @remarks
 * The v1 HTML-in-Canvas runtime uses its own public API, but `Engine` remains a
 * small utility for packages and experiments that need generic frame-loop
 * composition.
 */
export class Engine {
  private readonly loop: FrameLoop;

  /**
   * Creates an engine.
   *
   * @param options - Frame-loop options used by the engine.
   */
  constructor(options: FrameLoopOptions = {}) {
    this.loop = new FrameLoop(options);
  }

  /**
   * Adds a system to the engine.
   *
   * @param system - System called by the engine lifecycle.
   * @returns This engine for chaining.
   */
  use(system: EngineSystem): this {
    this.loop.addSystem(system);
    return this;
  }

  /**
   * Starts the engine frame loop.
   */
  start(): void {
    this.loop.start();
  }

  /**
   * Stops the engine frame loop.
   */
  stop(): void {
    this.loop.stop();
  }
}
