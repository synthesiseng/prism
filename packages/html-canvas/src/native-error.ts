/** Identifies a native paint failure without changing the selected backend. */
export class PrismNativeError extends Error {
  /** Stable category of native failure. */
  readonly code: "draw-failed" | "paint-timeout";

  /** Creates a diagnostic error, retaining the original draw exception when present. */
  constructor(
    code: "draw-failed" | "paint-timeout",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "PrismNativeError";
    this.code = code;
  }
}
