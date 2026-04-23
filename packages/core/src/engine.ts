import { FrameLoop, type FrameLoopOptions } from "./frame-loop";
import type { EngineSystem } from "./types";

export class Engine {
  private readonly loop: FrameLoop;

  constructor(options: FrameLoopOptions = {}) {
    this.loop = new FrameLoop(options);
  }

  use(system: EngineSystem): this {
    this.loop.addSystem(system);
    return this;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }
}
