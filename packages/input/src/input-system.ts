import { Vec2 } from "@prism/math";

/**
 * DOM event target used by `InputSystem`.
 */
export type InputTarget = Pick<
  HTMLElement,
  "addEventListener" | "removeEventListener" | "getBoundingClientRect"
>;

/**
 * Tracks keyboard and pointer state for a browser target.
 *
 * @remarks
 * Pointer coordinates are measured in CSS pixels relative to the attached
 * target. Use `CanvasRuntime.clientToCanvasPoint()` when you need coordinates
 * relative to a Prism runtime canvas.
 */
export class InputSystem {
  private readonly keys = new Set<string>();
  private pointerPosition = Vec2.zero;
  private pointerDown = false;
  private target: InputTarget | null = null;

  /**
   * Attaches the input system to a target.
   *
   * @param target - Element-like target that receives pointer events.
   */
  attach(target: InputTarget): void {
    if (this.target) {
      this.detach();
    }

    this.target = target;
    target.addEventListener("pointermove", this.onPointerMove);
    target.addEventListener("pointerdown", this.onPointerDown);
    target.addEventListener("pointerup", this.onPointerUp);
    globalThis.addEventListener("keydown", this.onKeyDown);
    globalThis.addEventListener("keyup", this.onKeyUp);
  }

  /**
   * Detaches event listeners and clears transient input state.
   */
  detach(): void {
    if (!this.target) {
      return;
    }

    this.target.removeEventListener("pointermove", this.onPointerMove);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    this.target.removeEventListener("pointerup", this.onPointerUp);
    globalThis.removeEventListener("keydown", this.onKeyDown);
    globalThis.removeEventListener("keyup", this.onKeyUp);
    this.target = null;
    this.keys.clear();
    this.pointerDown = false;
  }

  /**
   * Checks whether a keyboard code is currently pressed.
   *
   * @param code - DOM `KeyboardEvent.code` value.
   * @returns `true` when the key is currently down.
   */
  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  /**
   * Current pointer state in target-local CSS pixels.
   */
  get pointer(): Readonly<{ position: Vec2; down: boolean }> {
    return {
      position: this.pointerPosition,
      down: this.pointerDown
    };
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.target) {
      return;
    }

    const bounds = this.target.getBoundingClientRect();
    this.pointerPosition = new Vec2(event.clientX - bounds.left, event.clientY - bounds.top);
  };

  private readonly onPointerDown = (): void => {
    this.pointerDown = true;
  };

  private readonly onPointerUp = (): void => {
    this.pointerDown = false;
  };
}
