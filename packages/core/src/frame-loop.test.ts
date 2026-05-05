import { describe, expect, it, vi } from "vitest";
import { FrameLoop, type Raf } from "./frame-loop";

class ManualRaf {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextHandle = 1;
  readonly canceledHandles: number[] = [];

  request: Raf = (callback) => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  };

  cancel = (handle: number): void => {
    this.canceledHandles.push(handle);
    this.callbacks.delete(handle);
  };

  get pendingCount(): number {
    return this.callbacks.size;
  }

  step(nowMs = 16): void {
    const [handle, callback] = this.callbacks.entries().next().value ?? [];
    if (handle === undefined || callback === undefined) {
      throw new Error("Expected a pending frame callback.");
    }

    this.callbacks.delete(handle);
    callback(nowMs);
  }
}

function createLoop(raf: ManualRaf): FrameLoop {
  return new FrameLoop({
    requestAnimationFrame: raf.request,
    cancelAnimationFrame: raf.cancel
  });
}

describe("FrameLoop", () => {
  it("continues scheduling frames while running", () => {
    const raf = new ManualRaf();
    const loop = createLoop(raf);
    let updates = 0;
    let renders = 0;

    loop.addSystem({
      update: () => {
        updates += 1;
      },
      render: () => {
        renders += 1;
      }
    });

    loop.start();

    expect(raf.pendingCount).toBe(1);

    raf.step(16);
    raf.step(32);

    expect(updates).toBe(2);
    expect(renders).toBe(2);
    expect(raf.pendingCount).toBe(1);
  });

  it("does not schedule another frame when stop is called during update", () => {
    const raf = new ManualRaf();
    const loop = createLoop(raf);
    let updates = 0;
    let renders = 0;

    loop.addSystem({
      update: () => {
        updates += 1;
        loop.stop();
      },
      render: () => {
        renders += 1;
      }
    });

    loop.start();
    raf.step();

    expect(updates).toBe(1);
    expect(renders).toBe(1);
    expect(raf.pendingCount).toBe(0);
  });

  it("does not schedule another frame when stop is called during render", () => {
    const raf = new ManualRaf();
    const loop = createLoop(raf);
    let updates = 0;
    let renders = 0;

    loop.addSystem({
      update: () => {
        updates += 1;
      },
      render: () => {
        renders += 1;
        loop.stop();
      }
    });

    loop.start();
    raf.step();

    expect(updates).toBe(1);
    expect(renders).toBe(1);
    expect(raf.pendingCount).toBe(0);
  });

  it("keeps stop idempotent", () => {
    const raf = new ManualRaf();
    const loop = createLoop(raf);
    const stop = vi.fn();

    loop.addSystem({ stop });
    loop.start();
    loop.stop();
    loop.stop();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(raf.pendingCount).toBe(0);
    expect(raf.canceledHandles).toHaveLength(1);
  });

  it("does not keep the loop running after a handler error", () => {
    const raf = new ManualRaf();
    const loop = createLoop(raf);

    loop.addSystem({
      update: () => {
        throw new Error("update failed");
      }
    });

    loop.start();

    expect(() => {
      raf.step();
    }).toThrow("update failed");
    expect(raf.pendingCount).toBe(0);

    loop.start();

    expect(raf.pendingCount).toBe(1);
  });
});
