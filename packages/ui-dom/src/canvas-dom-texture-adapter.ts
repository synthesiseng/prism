import type { CapturedUiSurface, DomSurfaceSnapshot, DomTextureAdapter } from "./types";

export class CanvasDomTextureAdapter implements DomTextureAdapter {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private revision = 0;

  constructor(canvas: HTMLCanvasElement = document.createElement("canvas")) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not create 2D context for DOM texture adapter.");
    }

    this.ctx = ctx;
  }

  capture(surface: DomSurfaceSnapshot): CapturedUiSurface {
    const width = Math.max(1, Math.round(surface.bounds.width * surface.pixelRatio));
    const height = Math.max(1, Math.round(surface.bounds.height * surface.pixelRatio));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const ctx = this.ctx;
    const styles = getComputedStyle(surface.element);
    const title = surface.element.dataset.prismTitle ?? "";
    const body = surface.element.dataset.prismBody ?? normalizeText(surface.element.textContent);
    const accent = surface.element.dataset.prismAccent ?? "#5eead4";

    ctx.reset();
    ctx.scale(surface.pixelRatio, surface.pixelRatio);
    drawPanel(ctx, {
      width: surface.bounds.width,
      height: surface.bounds.height,
      title,
      body,
      accent,
      fontFamily: styles.fontFamily
    });

    this.revision += 1;

    return {
      width,
      height,
      revision: this.revision,
      source: this.canvas
    };
  }
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  options: Readonly<{
    width: number;
    height: number;
    title: string;
    body: string;
    accent: string;
    fontFamily: string;
  }>
): void {
  const { width, height, title, body, accent, fontFamily } = options;
  const radius = 10;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(4, 14, 24, 0.92)";
  roundedRect(ctx, 0, 0, width, height, radius);
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, 0.75, 0.75, width - 1.5, height - 1.5, radius);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.fillRect(16, 17, 30, 2);
  ctx.fillRect(width - 46, 17, 30, 2);

  ctx.fillStyle = "#ecfeff";
  ctx.font = `700 18px ${fontFamily}`;
  ctx.fillText(title, 16, 44);

  ctx.fillStyle = "rgba(236, 254, 255, 0.74)";
  ctx.font = `500 13px ${fontFamily}`;
  wrapText(ctx, body, 16, 72, width - 32, 18, Math.floor((height - 88) / 18));

  ctx.fillStyle = "rgba(94, 234, 212, 0.16)";
  ctx.fillRect(16, height - 34, width - 32, 16);
  ctx.fillStyle = accent;
  ctx.fillRect(16, height - 34, (width - 32) * 0.68, 16);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): void {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let lineCount = 0;

  for (const word of words) {
    const next = line.length === 0 ? word : `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }

    ctx.fillText(line, x, y + lineCount * lineHeight);
    line = word;
    lineCount += 1;

    if (lineCount >= maxLines) {
      return;
    }
  }

  if (line.length > 0 && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
