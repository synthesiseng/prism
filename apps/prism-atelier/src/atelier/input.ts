import type { CanvasRuntime } from "@synthesisengineering/prism";
import type { AtelierState } from "./types";

export function attachAtelierInput(
  target: HTMLElement,
  runtime: CanvasRuntime,
  state: AtelierState,
  onInput: () => void
): void {
  const updatePointer = (clientX: number, clientY: number): void => {
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    const y = -(((clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
    state.tx = clamp(x, -1, 1);
    state.ty = clamp(y, -1, 1);
    state.px = state.tx;
    state.py = state.ty;
    state.lastPointerAt = performance.now();
    state.pointerTrail.unshift({ x: state.tx, y: state.ty, age: 0 });
    state.pointerTrail = state.pointerTrail.slice(0, 28);
    runtime.invalidate();
    onInput();
  };

  target.addEventListener("pointermove", (event) => {
    updatePointer(event.clientX, event.clientY);
  }, { passive: true });

  target.addEventListener("pointerdown", (event) => {
    updatePointer(event.clientX, event.clientY);
  }, { passive: true });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
