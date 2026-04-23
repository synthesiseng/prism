/**
 * Canvas 2D context with native HTML-in-Canvas drawing support.
 *
 * @remarks
 * This type models experimental browser APIs and is exposed as an escape hatch
 * for capability checks and advanced integrations.
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
