/**
 * Canvas 2D context with native HTML-in-Canvas drawing support.
 *
 * @remarks
 * This internal type models experimental browser APIs used by Prism's native
 * backend. Applications should use the public `CanvasRuntime` API instead of
 * calling these browser primitives directly.
 */
export type HtmlCanvasContext2D = CanvasRenderingContext2D & {
  /**
   * Draws an HTML element into the canvas and returns the DOM transform.
   *
   * @param element - Element to draw into the canvas.
   * @param dx - Destination X coordinate in backing-store pixels.
   * @param dy - Destination Y coordinate in backing-store pixels.
   * @param dWidth - Optional destination width in backing-store pixels.
   * @param dHeight - Optional destination height in backing-store pixels.
   * @returns Transform used to synchronize the accessible DOM element.
   */
  drawElementImage(
    element: Element,
    dx: number,
    dy: number,
    dWidth?: number,
    dHeight?: number
  ): DOMMatrix;
};

/**
 * Canvas element with native HTML-in-Canvas paint support.
 *
 * @remarks
 * This is an internal runtime type for the native backend.
 */
export type HtmlCanvasElement = HTMLCanvasElement & {
  /**
   * Browser paint callback for native HTML-in-Canvas rendering.
   */
  onpaint: ((this: HTMLCanvasElement, event: Event) => void) | null;

  /**
   * Requests a native HTML-in-Canvas paint event.
   */
  requestPaint(): void;
};

/**
 * Checks whether a canvas and 2D context expose native HTML-in-Canvas APIs.
 *
 * @remarks
 * This is an internal capability check. Public code should prefer
 * `CanvasRuntime.backendKind` after constructing a runtime.
 *
 * @param canvas - Canvas element to test.
 * @param context - 2D context created from the canvas.
 * @returns `true` when native HTML-in-Canvas APIs are available.
 */
export function hasNativeHtmlCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
): canvas is HtmlCanvasElement {
  return (
    "requestPaint" in canvas &&
    typeof (canvas as Partial<HtmlCanvasElement>).requestPaint === "function" &&
    "drawElementImage" in context &&
    typeof (context as Partial<HtmlCanvasContext2D>).drawElementImage === "function"
  );
}
