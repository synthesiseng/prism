import type { Rect } from "@prism/math";
import type { HtmlCanvasContext2D, HtmlCanvasElement } from "../experimental-types";

// All current native platform operations live here; no browser-version routing.
export const nativePlatform = {
  activateCanvas(canvas: HTMLCanvasElement): () => void {
    const content = canvas.getAttribute("content");
    if (content !== null && content !== "drawable") {
      throw new Error(
        'Prism native canvas requires content="drawable"; incompatible content attribute.'
      );
    }
    if (content === null) canvas.setAttribute("content", "drawable");
    return () => {
      if (content === null) canvas.removeAttribute("content");
    };
  },
  activateSurface(element: HTMLElement): void {
    if (element.getAttribute("drawable") === null) element.setAttribute("drawable", "");
  },
  requestPaint(canvas: HTMLCanvasElement): void {
    (canvas as HtmlCanvasElement).requestPaint();
  },
  onPaint(canvas: HTMLCanvasElement, handler: () => void): () => void {
    canvas.addEventListener("paint", handler);
    return () => canvas.removeEventListener("paint", handler);
  },
  draw(ctx: HtmlCanvasContext2D, element: HTMLElement, bounds: Rect): void {
    ctx.drawElementImage(element, bounds.x, bounds.y, bounds.width, bounds.height);
  }
};
