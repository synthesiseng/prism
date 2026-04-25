"use client";

import { CanvasRuntime, type CanvasSurface } from "@synthesisengineering/prism";
import { useEffect, useRef, useState } from "react";

const paintSteps = ["registered", "paintOnce()", "ready"] as const;

type DemoMode = "preview" | "native";
type DemoSurfaceSet = Readonly<{
  registered: CanvasSurface;
  code: CanvasSurface;
  tooltip: CanvasSurface;
  pass: CanvasSurface;
}>;

export function PrismHomeDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<DemoMode>("preview");

  useEffect(() => {
    const canvas = canvasRef.current;
    const title = titleRef.current;
    const code = codeRef.current;
    const tooltip = tooltipRef.current;
    const pass = passRef.current;

    if (!canvas || !title || !code || !tooltip || !pass) {
      return;
    }

    // Match the examples: create Prism with backend "auto" and let the runtime
    // choose native when the browser exposes HTML-in-Canvas.
    const runtime = new CanvasRuntime(canvas, { backend: "auto" });

    if (runtime.backendKind !== "native") {
      runtime.destroy();
      setMode("preview");
      return;
    }

    setMode("native");

    const surfaces: DemoSurfaceSet = {
      registered: runtime.registerSurface(title, {
        bounds: { x: 24, y: 92, width: 172, height: 112 }
      }),
      code: runtime.registerSurface(code, {
        bounds: { x: 300, y: 96, width: 232, height: 142 }
      }),
      tooltip: runtime.registerSurface(tooltip, {
        bounds: { x: 340, y: 252, width: 150, height: 76 }
      }),
      pass: runtime.registerSurface(pass, {
        bounds: { x: 24, y: 262, width: 178, height: 104 }
      })
    };
    let layoutKey = "";

    runtime.onPaint(({ ctx, drawSurface }) => {
      const width = runtime.width;
      const height = runtime.height;

      if (width <= 0 || height <= 0) {
        return;
      }

      layoutKey = syncDemoSurfaceBounds(surfaces, width, height, layoutKey);

      ctx.save();
      ctx.scale(runtime.pixelRatio, runtime.pixelRatio);
      drawDemoCanvas(ctx, width, height);
      ctx.restore();

      for (const surface of Object.values(surfaces)) {
        drawSurface(surface);
      }
    });

    runtime.start();

    return () => {
      runtime.destroy();
      setMode("preview");
    };
  }, []);

  return (
    <div
      className={mode === "native" ? "prism-canvas-frame is-native" : "prism-canvas-frame"}
      aria-label="Prism canvas surface demo"
    >
      <DemoTopbar mode={mode} />

      <canvas ref={canvasRef} className="prism-native-canvas" />
      {mode === "native" ? null : <PreviewCanvasBody />}

      <div ref={titleRef} className="prism-native-surface prism-demo-surface prism-surface-registered">
        <SurfaceRegisteredContent />
      </div>
      <div ref={codeRef} className="prism-native-surface prism-demo-surface prism-surface-code">
        <CodeSurfaceContent />
      </div>
      <div ref={tooltipRef} className="prism-native-surface prism-surface-card surface-tooltip">
        <TooltipSurfaceContent />
      </div>
      <div ref={passRef} className="prism-native-surface prism-demo-surface prism-surface-pass">
        <PaintPassContent />
      </div>
    </div>
  );
}

function DemoTopbar({ mode }: { mode: DemoMode }) {
  return (
    <div className="prism-canvas-topbar">
      <span>&lt;canvas&gt; · 720 × 360</span>
      <span className={mode === "native" ? "prism-runtime-badge native" : "prism-runtime-badge"}>
        {mode === "native" ? "Native runtime" : "Preview mode"}
      </span>
    </div>
  );
}

function PreviewCanvasBody() {
  return (
    <div className="prism-canvas-body">
      <div className="prism-preview-visual" aria-hidden="true">
        <DemoComposition />
      </div>

      <div className="prism-demo-gate" role="status">
        <h2>Enable the browser flag to view the live Prism runtime.</h2>
        <code>chrome://flags/#canvas-draw-element</code>
      </div>
    </div>
  );
}

function DemoComposition() {
  return (
    <>
      <DemoTrace />
      <div className="prism-demo-label canvas-label">
        <span />
        canvas drawing
      </div>
      <div className="prism-demo-label surface-label">
        <span />
        HTML / CSS surface
      </div>
      <div className="prism-demo-surface prism-surface-registered">
        <SurfaceRegisteredContent />
      </div>
      <div className="prism-demo-surface prism-surface-code">
        <CodeSurfaceContent />
      </div>
      <div className="prism-surface-card surface-tooltip">
        <TooltipSurfaceContent />
      </div>
      <div className="prism-demo-surface prism-surface-pass">
        <PaintPassContent />
      </div>
      <div className="prism-export-chip">
        <span />
        export · png · 1440 × 720
      </div>
      <svg className="prism-demo-connectors" aria-hidden="true" viewBox="0 0 720 380" preserveAspectRatio="none">
        <line x1="84" y1="48" x2="84" y2="92" />
        <line x1="640" y1="48" x2="640" y2="96" />
      </svg>
      <div className="prism-demo-caption">one canvas · many surfaces · single paint pass</div>
    </>
  );
}

function SurfaceRegisteredContent() {
  return (
    <>
      <div className="prism-surface-kicker">
        <span />
        surface · #s_1f3
      </div>
      <strong>Surface registered</strong>
      <code>
        bounds · 184 × 92
        <br />
        origin · (28, 86)
        <br />
        attached · &lt;canvas&gt;
      </code>
    </>
  );
}

function CodeSurfaceContent() {
  return (
    <>
      <div className="prism-code-title">
        <span>register.ts</span>
        <span>ts</span>
      </div>
      <pre>
        <code>
          <span>const runtime = </span>
          <b>new CanvasRuntime</b>
          <span>(canvas);</span>
          {"\n"}
          <span>runtime.</span>
          <i>registerSurface</i>
          <span>(el, opts);</span>
          {"\n"}
          <span>await runtime.</span>
          <i>paintOnce</i>
          <span>();</span>
        </code>
      </pre>
    </>
  );
}

function TooltipSurfaceContent() {
  return (
    <>
      <span className="tooltip-title">tooltip · surface#3</span>
      <div>
        <span>x · y</span>
        <strong>460.0, 180.5</strong>
      </div>
      <div>
        <span>value</span>
        <strong className="violet">0.612</strong>
      </div>
    </>
  );
}

function PaintPassContent() {
  return (
    <>
      <div className="prism-pass-title">Prism paint pass</div>
      {paintSteps.map((step, index) => (
        <div key={step} className={index < 2 ? "active" : undefined}>
          <span />
          {step}
        </div>
      ))}
    </>
  );
}

function syncDemoSurfaceBounds(
  surfaces: DemoSurfaceSet,
  width: number,
  height: number,
  previousKey: string
): string {
  const registeredWidth = clamp(width * 0.3, 150, 172);
  const codeWidth = clamp(width * 0.36, 194, 232);
  const tooltipWidth = clamp(width * 0.24, 128, 150);
  const passWidth = clamp(width * 0.3, 158, 178);
  const margin = 22;
  const codeX = Math.max(width - codeWidth - margin, margin + registeredWidth + 24);
  const tooltipX = Math.max(
    margin + passWidth + 20,
    Math.min(width - tooltipWidth - margin, codeX + codeWidth - tooltipWidth - 8)
  );
  const passY = Math.min(height - 116, 262);

  const next = {
    registered: { x: margin, y: 92, width: registeredWidth, height: 112 },
    code: { x: codeX, y: 96, width: codeWidth, height: 142 },
    tooltip: { x: tooltipX, y: 246, width: tooltipWidth, height: 76 },
    pass: { x: margin, y: passY, width: passWidth, height: 104 }
  };
  const nextKey = JSON.stringify(next);

  if (nextKey !== previousKey) {
    surfaces.registered.setBounds(next.registered);
    surfaces.code.setBounds(next.code);
    surfaces.tooltip.setBounds(next.tooltip);
    surfaces.pass.setBounds(next.pass);
  }

  return nextKey;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function DemoTrace() {
  return (
    <svg
      aria-hidden="true"
      className="prism-canvas-trace"
      viewBox="0 0 720 380"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="prism-trace" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#7c5cff" stopOpacity="0" />
          <stop offset="45%" stopColor="#7c5cff" stopOpacity="0.76" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id="prism-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,300 C120,260 200,200 320,210 C440,220 520,140 640,130 C690,128 720,150 720,150 L720,380 L0,380 Z"
        fill="url(#prism-fill)"
      />
      <path
        d="M0,300 C120,260 200,200 320,210 C440,220 520,140 640,130 C690,128 720,150 720,150"
        fill="none"
        stroke="url(#prism-trace)"
        strokeWidth="1.5"
      />
      <path
        d="M0,330 C120,310 200,290 320,280 C440,270 520,230 640,210 C690,205 720,215 720,215"
        fill="none"
        stroke="#22d3ee"
        strokeDasharray="3 4"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      {[
        [60, 280],
        [180, 225],
        [320, 210],
        [460, 180],
        [600, 140]
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="3" fill="#7c5cff" />
          <circle cx={x} cy={y} r="6" fill="none" stroke="#7c5cff" strokeOpacity="0.3" />
        </g>
      ))}
      <g opacity="0.6">
        <line x1="460" y1="0" x2="460" y2="380" stroke="rgba(124,92,255,0.25)" strokeDasharray="2 4" />
        <line x1="0" y1="180" x2="720" y2="180" stroke="rgba(124,92,255,0.25)" strokeDasharray="2 4" />
      </g>
    </svg>
  );
}

function drawDemoCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);

  const bodyHeight = Math.max(1, height);
  const grid = 32;
  const majorGrid = 128;

  const gradient = ctx.createLinearGradient(0, 0, 0, bodyHeight);
  gradient.addColorStop(0, "rgba(124, 92, 255, 0.04)");
  gradient.addColorStop(0.5, "rgba(5, 5, 7, 1)");
  gradient.addColorStop(1, "rgba(6, 182, 212, 0.04)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, bodyHeight);

  drawGrid(ctx, width, bodyHeight, grid, "rgba(255,255,255,0.06)");
  drawGrid(ctx, width, bodyHeight, majorGrid, "rgba(255,255,255,0.12)");
  drawTrace(ctx, width, bodyHeight);
  drawCanvasAnnotations(ctx, width, bodyHeight);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  step: number,
  strokeStyle: string
): void {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTrace(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.scale(width / 720, height / 380);

  const fillGradient = ctx.createLinearGradient(0, 0, 0, 380);
  fillGradient.addColorStop(0, "rgba(124, 92, 255, 0.18)");
  fillGradient.addColorStop(1, "rgba(124, 92, 255, 0)");

  const strokeGradient = ctx.createLinearGradient(0, 0, 720, 0);
  strokeGradient.addColorStop(0, "rgba(124, 92, 255, 0)");
  strokeGradient.addColorStop(0.45, "rgba(124, 92, 255, 0.76)");
  strokeGradient.addColorStop(1, "rgba(34, 211, 238, 0.78)");

  const path = new Path2D(
    "M0,300 C120,260 200,200 320,210 C440,220 520,140 640,130 C690,128 720,150 720,150"
  );
  const fill = new Path2D(
    "M0,300 C120,260 200,200 320,210 C440,220 520,140 640,130 C690,128 720,150 720,150 L720,380 L0,380 Z"
  );
  const dashed = new Path2D(
    "M0,330 C120,310 200,290 320,280 C440,270 520,230 640,210 C690,205 720,215 720,215"
  );

  ctx.fillStyle = fillGradient;
  ctx.fill(fill);
  ctx.strokeStyle = strokeGradient;
  ctx.lineWidth = 1.5;
  ctx.stroke(path);

  ctx.strokeStyle = "rgba(34, 211, 238, 0.45)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.stroke(dashed);
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(124,92,255,0.25)";
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(460, 0);
  ctx.lineTo(460, 380);
  ctx.moveTo(0, 180);
  ctx.lineTo(720, 180);
  ctx.stroke();
  ctx.setLineDash([]);

  const samplePoints: ReadonlyArray<readonly [number, number]> = [
    [60, 280],
    [180, 225],
    [320, 210],
    [460, 180],
    [600, 140]
  ];

  for (const [x, y] of samplePoints) {
    ctx.beginPath();
    ctx.fillStyle = "#7c5cff";
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(124,92,255,0.3)";
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCanvasAnnotations(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = "10.5px ui-monospace, SFMono-Regular, Menlo, monospace";

  ctx.fillStyle = "rgba(255,255,255,0.32)";
  drawRoundRect(ctx, 14, 38, 8, 8, 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("canvas drawing", 30, 43);

  ctx.fillStyle = "#a78bfa";
  drawRoundRect(ctx, width - 140, 38, 8, 8, 2);
  ctx.fill();
  ctx.fillText("HTML / CSS surface", width - 124, 43);

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(84, 48);
  ctx.lineTo(84, 92);
  ctx.stroke();
  ctx.strokeStyle = "rgba(167,139,250,0.4)";
  ctx.beginPath();
  ctx.moveTo(width - 80, 48);
  ctx.lineTo(width - 80, 96);
  ctx.stroke();
  ctx.setLineDash([]);

  const chipText = "export · png · 1440 × 720";
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  const chipWidth = ctx.measureText(chipText).width + 42;
  const chipX = width - chipWidth - 28;
  const chipY = height - 68;
  drawRoundRect(ctx, chipX, chipY, chipWidth, 30, 15);
  ctx.fillStyle = "#0f0f15";
  ctx.fill();
  ctx.strokeStyle = "rgba(34,211,238,0.4)";
  ctx.stroke();
  ctx.fillStyle = "#22d3ee";
  ctx.beginPath();
  ctx.arc(chipX + 18, chipY + 15, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(chipText, chipX + 34, chipY + 16);

  ctx.font = "10.5px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  const caption = "one canvas · many surfaces · single paint pass";
  ctx.fillText(caption, (width - ctx.measureText(caption).width) / 2, height - 10);

  ctx.restore();
}

function drawRoundRect(
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
