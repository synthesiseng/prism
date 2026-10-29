/** Application layout failed to settle within the bounded native paint episode. */
export class LayoutConvergenceError extends Error {
  /** Creates a layout failure without classifying it as a native platform error. */
  constructor() {
    super("Surface layout did not converge after four paint passes. Fix the layout, then call setBounds() or invalidate() outside paint to retry.");
    this.name = "LayoutConvergenceError";
  }
}
