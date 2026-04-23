export type HtmlCanvasContext2D = CanvasRenderingContext2D & {
  drawElementImage(
    element: Element,
    dx: number,
    dy: number,
    dWidth?: number,
    dHeight?: number
  ): DOMMatrix;
};

export type HtmlCanvasElement = HTMLCanvasElement & {
  onpaint: ((this: HTMLCanvasElement, event: Event) => void) | null;
  requestPaint(): void;
};

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
