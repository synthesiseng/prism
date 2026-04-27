import type { CanvasRuntime, CanvasSurface } from "@synthesisengineering/prism";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exportCanvasPng } from "./composer/export";
import {
  bringSurfaceToFront,
  createSurface,
  defaultComposition,
  moveLayer,
  stageFormats
} from "./composer/state";
import type {
  ComposerSurface,
  ExportState,
  GhostSurface,
  ResizeHandle,
  StageFormat,
  TemplateId,
  Transform
} from "./composer/types";
import { PrismMark, CheckIcon, DownloadIcon } from "./icons";
import { LeftPanel, RightPanel } from "./panels";
import { usePrismRuntime } from "./prism/usePrismRuntime";
import { Stage } from "./stage";
import { templateRegistry } from "./templates/registry";

const minSurfaceSize = {
  width: 120,
  height: 80
} as const;
const sideChromeWidth = 620;
const stageBackground = "#0c0c0c";

export function App() {
  const [initialDocument] = useState(() => {
    const initialSurfaces = defaultComposition();
    return {
      selectedId: initialSurfaces.at(-1)?.id ?? null,
      surfaces: initialSurfaces
    };
  });
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const runtime = usePrismRuntime(canvas);
  const [format, setFormat] = useState<StageFormat>(stageFormats.og);
  const [surfaces, setSurfaces] = useState<ComposerSurface[]>(initialDocument.surfaces);
  const [selectedId, setSelectedId] = useState<string | null>(initialDocument.selectedId);
  const [ghost, setGhost] = useState<GhostSurface | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotationPreview, setRotationPreview] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [viewportSize, setViewportSize] = useState(() => ({
    width: Math.max(320, window.innerWidth - sideChromeWidth),
    height: Math.max(320, window.innerHeight - 48)
  }));

  // Composer document state stays serializable. Prism runtime objects are kept
  // outside the document model and are only used at the paint/export boundary.
  const surfacesRef = useRef(surfaces);
  const prismSurfacesRef = useRef(new Map<string, CanvasSurface>());

  useEffect(() => {
    surfacesRef.current = surfaces;
    runtime?.invalidate();
  }, [runtime, surfaces]);

  useEffect(() => {
    const onResize = (): void => {
      setViewportSize({
        width: Math.max(320, window.innerWidth - sideChromeWidth),
        height: Math.max(320, window.innerHeight - 48)
      });
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!runtime) {
      return;
    }

    // Prism owns the canvas paint lifecycle. Composer only decides composition
    // order and per-surface transforms before asking Prism to draw each surface.
    runtime.onPaint(({ ctx, drawSurface }) => {
      ctx.fillStyle = stageBackground;
      ctx.fillRect(0, 0, runtime.canvas.width, runtime.canvas.height);

      for (const model of surfacesRef.current) {
        const prismSurface = prismSurfacesRef.current.get(model.id);
        if (!prismSurface || prismSurface.isDisposed) {
          continue;
        }

        drawTransformedSurface(runtime, ctx, model.transform, () => {
          drawSurface(prismSurface);
        });
      }
    });
    runtime.start();

    return () => {
      runtime.stop();
    };
  }, [runtime]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const activeElement = document.activeElement;
      const activeTag = activeElement instanceof HTMLElement ? activeElement.tagName : "";

      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }

      if (
        selectedId &&
        (event.key === "Delete" || event.key === "Backspace") &&
        !["INPUT", "TEXTAREA"].includes(activeTag)
      ) {
        setSurfaces((current) => {
          const next = current.filter((surface) => surface.id !== selectedId);
          setSelectedId(next.at(-1)?.id ?? null);
          return next;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedId]);

  const stageScale = useMemo(() => {
    const padding = 40;
    const scaleX = (viewportSize.width - padding * 2) / format.width;
    const scaleY = (viewportSize.height - padding * 2 - 32) / format.height;
    return Math.max(0.16, Math.min(scaleX, scaleY, 1));
  }, [format.height, format.width, viewportSize.height, viewportSize.width]);
  const hasNativeSupport = runtime?.backendKind === "native";

  const selectedSurface = surfaces.find((surface) => surface.id === selectedId) ?? null;
  const inspectedSurface = selectedSurface ?? surfaces.at(-1) ?? null;
  const inspectedId = selectedId ?? inspectedSurface?.id ?? null;

  const replaceSurface = useCallback((nextSurface: ComposerSurface): void => {
    setSurfaces((current) =>
      current.map((surface) => (surface.id === nextSurface.id ? nextSurface : surface))
    );
  }, []);

  const selectSurface = useCallback((id: string): void => {
    setSelectedId(id);
    setSurfaces((current) => bringSurfaceToFront(current, id));
  }, []);

  const updateSurfaceTransform = useCallback((id: string, transform: Transform): void => {
    setSurfaces((current) =>
      current.map((surface) => (surface.id === id ? { ...surface, transform } : surface))
    );
  }, []);

  const addTemplate = useCallback(
    (templateId: TemplateId): void => {
      const template = templateRegistry[templateId];
      const x = Math.max(
        40,
        (format.width - template.defaultSize.width) / 2 + (Math.random() - 0.5) * 80
      );
      const y = Math.max(
        40,
        (format.height - template.defaultSize.height) / 2 + (Math.random() - 0.5) * 60
      );
      const nextSurface = createSurface(templateId, {
        x: -template.defaultSize.width - 40,
        y,
        enterDelay: 0
      });

      setSurfaces((current) => [...current, nextSurface]);
      setSelectedId(nextSurface.id);

      requestAnimationFrame(() => {
        updateSurfaceTransform(nextSurface.id, {
          ...nextSurface.transform,
          x,
          y
        });
      });
    },
    [format.height, format.width, updateSurfaceTransform]
  );

  const onSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, id: string): void => {
      event.stopPropagation();
      selectSurface(id);
      const surface = surfacesRef.current.find((item) => item.id === id);
      if (!surface) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;
      const startTransform = surface.transform;

      const onMove = (moveEvent: PointerEvent): void => {
        const dx = (moveEvent.clientX - startX) / stageScale;
        const dy = (moveEvent.clientY - startY) / stageScale;
        updateSurfaceTransform(id, {
          ...startTransform,
          x: startTransform.x + dx,
          y: startTransform.y + dy
        });
      };
      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [selectSurface, stageScale, updateSurfaceTransform]
  );

  const onResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>, handle: ResizeHandle): void => {
      event.stopPropagation();
      event.preventDefault();
      const surface = selectedSurface;
      if (!surface) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;
      const startTransform = surface.transform;

      const onMove = (moveEvent: PointerEvent): void => {
        const dx = (moveEvent.clientX - startX) / stageScale;
        const dy = (moveEvent.clientY - startY) / stageScale;
        updateSurfaceTransform(
          surface.id,
          resizeTransform(startTransform, handle, dx, dy)
        );
      };
      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [selectedSurface, stageScale, updateSurfaceTransform]
  );

  const onRotateStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      event.stopPropagation();
      event.preventDefault();
      const surface = selectedSurface;
      if (!surface || !canvas) {
        return;
      }

      setRotating(true);
      const canvasRect = canvas.getBoundingClientRect();
      const centerX =
        canvasRect.left +
        (surface.transform.x + surface.transform.width / 2) * stageScale;
      const centerY =
        canvasRect.top +
        (surface.transform.y + surface.transform.height / 2) * stageScale;
      const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
      const startRotation = surface.transform.rotation;
      let lastSnap: number | null = null;

      const onMove = (moveEvent: PointerEvent): void => {
        const angle = Math.atan2(
          moveEvent.clientY - centerY,
          moveEvent.clientX - centerX
        );
        const rawDegrees = startRotation + ((angle - startAngle) * 180) / Math.PI;
        const degrees = snapRotation(rawDegrees);

        if (degrees.snap !== null && degrees.snap !== lastSnap) {
          lastSnap = degrees.snap;
          setPulse(true);
          window.setTimeout(() => {
            setPulse(false);
          }, 180);
        } else if (degrees.snap === null) {
          lastSnap = null;
        }

        setRotationPreview(degrees.value);
        updateSurfaceTransform(surface.id, {
          ...surface.transform,
          rotation: degrees.value
        });
      };
      const onUp = (): void => {
        setRotating(false);
        setRotationPreview(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [canvas, selectedSurface, stageScale, updateSurfaceTransform]
  );

  const onSurfaceRegistered = useCallback(
    (id: string, surface: CanvasSurface | null): void => {
      if (surface) {
        prismSurfacesRef.current.set(id, surface);
      } else {
        prismSurfacesRef.current.delete(id);
      }
      runtime?.invalidate();
    },
    [runtime]
  );

  const onGhostShow = useCallback(
    (templateId: TemplateId): void => {
      if (ghost) {
        return;
      }

      const template = templateRegistry[templateId];
      setGhost({
        x: (format.width - template.defaultSize.width) / 2,
        y: (format.height - template.defaultSize.height) / 2,
        width: template.defaultSize.width,
        height: template.defaultSize.height
      });
    },
    [format.height, format.width, ghost]
  );

  const onExport = useCallback(async (): Promise<void> => {
    if (exportState !== "idle" || !runtime || !canvas) {
      return;
    }

    setExportState("loading");
    setSelectedId(null);

    try {
      // Let React commit selection changes before Prism performs the export
      // readiness paint pass.
      await nextFrame();
      await exportCanvasPng(runtime, canvas, format);
      setExportState("done");
      window.setTimeout(() => {
        setExportState("idle");
      }, 1200);
    } catch (error) {
      console.error(error);
      setExportState("idle");
    }
  }, [canvas, exportState, format, runtime]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <PrismMark size={20} />
          <span className="brand-name">Prism</span>
          <span className="brand-sub">Composer</span>
        </div>
        {rotating && rotationPreview !== null ? (
          <div className="topbar-center">
            <span className="rotation-pill">{Math.round(rotationPreview)}°</span>
          </div>
        ) : null}
        <div className="topbar-right">
          <button
            className={`export ${exportState === "loading" ? "is-loading" : ""} ${
              exportState === "done" ? "is-done" : ""
            }`}
            disabled={exportState !== "idle" || !runtime || !hasNativeSupport}
            type="button"
            onClick={() => {
              void onExport();
            }}
          >
            {exportState === "idle" ? (
              <>
                <DownloadIcon size={12} /> Export PNG
              </>
            ) : null}
            {exportState === "loading" ? <>Rendering...</> : null}
            {exportState === "done" ? (
              <>
                <CheckIcon size={12} /> Exported
              </>
            ) : null}
            {exportState === "loading" ? (
              <span className="arc">
                <svg preserveAspectRatio="none" viewBox="0 0 100 100">
                  <rect
                    fill="none"
                    height="98"
                    rx="8"
                    ry="8"
                    stroke="#7B61FF"
                    strokeDasharray="392"
                    strokeDashoffset="392"
                    strokeWidth="2"
                    width="98"
                    x="1"
                    y="1"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      dur="0.9s"
                      fill="freeze"
                      from="392"
                      to="0"
                    />
                  </rect>
                </svg>
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <div className="workspace">
        {runtime && !hasNativeSupport ? <NativeSupportGate /> : null}

        <LeftPanel
          format={format}
          onAddTemplate={addTemplate}
          onFormat={setFormat}
          onGhostHide={() => {
            setGhost(null);
          }}
          onGhostShow={onGhostShow}
        />

        <Stage
          canvasRef={setCanvas}
          clearSelection={() => {
            setSelectedId(null);
          }}
          format={format}
          ghost={ghost}
          pulse={pulse}
          rotating={rotating}
          runtime={runtime}
          selectedId={selectedId}
          stageScale={stageScale}
          surfaces={surfaces}
          onResizeStart={onResizeStart}
          onRotateStart={onRotateStart}
          onSelect={selectSurface}
          onSurfacePointerDown={onSurfacePointerDown}
          onSurfaceRegistered={onSurfaceRegistered}
        />

        <RightPanel
          bringForward={() => {
            setSurfaces((current) => moveLayer(current, inspectedId, "forward"));
          }}
          selectedId={inspectedId}
          sendBackward={() => {
            setSurfaces((current) => moveLayer(current, inspectedId, "backward"));
          }}
          surface={inspectedSurface}
          onSurfaceChange={replaceSurface}
        />
      </div>
    </div>
  );
}

function NativeSupportGate() {
  return (
    <div className="native-gate" role="alert">
      <div className="native-gate-card">
        <p className="native-gate-eyebrow">Native HTML-in-Canvas required</p>
        <h2>Prism Composer requires native HTML-in-Canvas.</h2>
        <p>
          Enable <code>chrome://flags/#canvas-draw-element</code> in Chromium/Chrome Canary.
        </p>
        <div className="native-gate-flag">chrome://flags/#canvas-draw-element</div>
      </div>
    </div>
  );
}

function drawTransformedSurface(
  runtime: CanvasRuntime,
  ctx: CanvasRenderingContext2D,
  transform: Transform,
  draw: () => void
): void {
  // Surface transforms are stored in CSS pixels. Direct canvas drawing happens
  // in backing-store pixels, so Prism converts the rotation origin for us.
  const center = runtime.cssPointToCanvasPixels({
    x: transform.x + transform.width / 2,
    y: transform.y + transform.height / 2
  });

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.translate(-center.x, -center.y);
  draw();
  ctx.restore();
}

function resizeTransform(
  start: Transform,
  handle: ResizeHandle,
  dx: number,
  dy: number
): Transform {
  // Keep resizing explicit and edge-based so each handle has predictable
  // behavior without introducing a layout or constraint system.
  const movesLeft = handle.includes("w");
  const movesRight = handle.includes("e");
  const movesTop = handle.includes("n");
  const movesBottom = handle.includes("s");
  const rawWidth = start.width + (movesRight ? dx : 0) - (movesLeft ? dx : 0);
  const rawHeight = start.height + (movesBottom ? dy : 0) - (movesTop ? dy : 0);
  const width = Math.max(minSurfaceSize.width, rawWidth);
  const height = Math.max(minSurfaceSize.height, rawHeight);
  const x = movesLeft ? start.x + start.width - width : start.x;
  const y = movesTop ? start.y + start.height - height : start.y;

  return {
    ...start,
    x,
    y,
    width,
    height
  };
}

function snapRotation(value: number): Readonly<{ value: number; snap: number | null }> {
  const snapPoints = [-180, -135, -90, -45, 0, 45, 90, 135, 180] as const;
  const snap = snapPoints.find((point) => {
    const distance = Math.abs(((value - point + 540) % 360) - 180);
    return distance < 6;
  });

  return {
    value: snap ?? value,
    snap: snap ?? null
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}
