import type { EngineSystem, FrameTime } from "./types";

export type Raf = (callback: FrameRequestCallback) => number;
export type Caf = (handle: number) => void;

export type FrameLoopOptions = Readonly<{
  requestAnimationFrame?: Raf;
  cancelAnimationFrame?: Caf;
  maxDelta?: number;
}>;

export class FrameLoop {
  private readonly systems: EngineSystem[] = [];
  private readonly requestFrame: Raf;
  private readonly cancelFrame: Caf;
  private readonly maxDelta: number;
  private frameHandle: number | null = null;
  private lastTime = 0;
  private frame = 0;

  constructor(options: FrameLoopOptions = {}) {
    this.requestFrame =
      options.requestAnimationFrame ??
      ((callback) => globalThis.requestAnimationFrame(callback));
    this.cancelFrame =
      options.cancelAnimationFrame ??
      ((handle) => globalThis.cancelAnimationFrame(handle));
    this.maxDelta = options.maxDelta ?? 1 / 20;
  }

  addSystem(system: EngineSystem): void {
    this.systems.push(system);
  }

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
