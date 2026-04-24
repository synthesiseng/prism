import type { CanvasRuntime, CanvasSurface } from "@synthesisengineering/prism";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useState } from "react";
import type {
  ComposerSurface,
  GhostSurface,
  ResizeHandle,
  StageFormat,
  Transform
} from "./composer/types";
import { usePrismSurface } from "./prism/usePrismSurface";
import { SurfaceTemplate, surfaceStyle, templateRegistry } from "./templates/registry";

type StageProps = Readonly<{
  canvasRef: (canvas: HTMLCanvasElement | null) => void;
  runtime: CanvasRuntime | null;
  format: StageFormat;
  stageScale: number;
  surfaces: readonly ComposerSurface[];
  selectedId: string | null;
  rotating: boolean;
  pulse: boolean;
  ghost: GhostSurface | null;
  onSelect(id: string): void;
  onSurfacePointerDown(event: ReactPointerEvent<HTMLElement>, id: string): void;
  onRotateStart(event: ReactPointerEvent<HTMLElement>): void;
  onResizeStart(event: ReactPointerEvent<HTMLElement>, handle: ResizeHandle): void;
  onSurfaceRegistered(id: string, surface: CanvasSurface | null): void;
  clearSelection(): void;
}>;

export function Stage({
  canvasRef,
  runtime,
  format,
  stageScale,
  surfaces,
  selectedId,
  rotating,
  pulse,
  ghost,
  onSelect,
  onSurfacePointerDown,
  onRotateStart,
  onResizeStart,
  onSurfaceRegistered,
  clearSelection
}: StageProps) {
  const selectedSurface = surfaces.find((surface) => surface.id === selectedId) ?? null;

  return (
    <div
      className="stage-area"
      onPointerDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          (event.target.classList.contains("stage-area") ||
            event.target.classList.contains("stage-viewport"))
        ) {
          clearSelection();
        }
      }}
    >
      <div className="stage-viewport">
        <div className="stage-fit" style={{ transform: `scale(${String(stageScale)})` }}>
          <div className="stage-wrap">
            <div className="stage-glow" style={{ width: format.width, height: 80 }} />
            <div
              className="stage-plane"
              style={{ width: format.width, height: format.height }}
            >
              <canvas
                ref={canvasRef}
                aria-label="Prism Composer canvas"
                className="stage"
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    clearSelection();
                  }
                }}
              >
                {/* Native HTML-in-Canvas surfaces are real canvas children.
                    Prism registers these nodes and owns their paint lifecycle. */}
                {surfaces.map((surface, layerIndex) => (
                  <SurfaceSource
                    key={surface.id}
                    layerIndex={layerIndex}
                    model={surface}
                    runtime={runtime}
                    selected={surface.id === selectedId}
                    onPointerDown={onSurfacePointerDown}
                    onRegistered={onSurfaceRegistered}
                    onSelect={onSelect}
                  />
                ))}
              </canvas>
              {selectedSurface ? (
                <SelectionOverlay
                  pulse={pulse}
                  rotating={rotating}
                  surface={selectedSurface}
                  onResizeStart={onResizeStart}
                  onRotateStart={onRotateStart}
                />
              ) : null}
              {ghost ? (
                <div
                  className="ghost"
                  style={{
                    left: ghost.x,
                    top: ghost.y,
                    width: ghost.width,
                    height: ghost.height
                  }}
                />
              ) : null}
            </div>
            <div className="stage-label">
              {format.width} x {format.height}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SurfaceSource({
  runtime,
  model,
  layerIndex,
  selected,
  onPointerDown,
  onRegistered,
  onSelect
}: Readonly<{
  runtime: CanvasRuntime | null;
  model: ComposerSurface;
  layerIndex: number;
  selected: boolean;
  onPointerDown(event: ReactPointerEvent<HTMLElement>, id: string): void;
  onRegistered(id: string, surface: CanvasSurface | null): void;
  onSelect(id: string): void;
}>) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  usePrismSurface({ runtime, element, model, onRegistered });

  const shadowClass = `sh-${model.appearance.shadow}`;

  return (
    <div
      ref={setElement}
      className={`surface-source ${selected ? "is-selected" : ""}`}
      data-prism-surface-title={templateRegistry[model.template].name}
      style={surfaceStyle(model, layerIndex)}
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(model.id);
      }}
      onPointerDown={(event) => {
        onPointerDown(event, model.id);
      }}
    >
      <div
        className={`surface-content ${shadowClass}`}
        style={
          {
            "--surface-p": `${String(model.appearance.padding)}px`,
            "--surface-r": `${String(model.appearance.radius)}px`
          } as CSSProperties
        }
      >
        <SurfaceTemplate surface={model} />
      </div>
    </div>
  );
}

function SelectionOverlay({
  surface,
  pulse,
  onRotateStart,
  onResizeStart
}: Readonly<{
  surface: ComposerSurface;
  rotating: boolean;
  pulse: boolean;
  onRotateStart(event: ReactPointerEvent<HTMLElement>): void;
  onResizeStart(event: ReactPointerEvent<HTMLElement>, handle: ResizeHandle): void;
}>) {
  const template = templateRegistry[surface.template];
  const transform = surface.transform;
  const style = selectionStyle(transform);
  const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  return (
    <div className="selection" style={style}>
      <div className={`selection-border ${pulse ? "pulse" : ""}`} />
      <div className="selection-tag">
        {template.name}
        <span className="muted">
          {Math.round(transform.width)} x {Math.round(transform.height)}
        </span>
      </div>
      <div className="rotate-stem" />
      <div className="rotate-handle" onPointerDown={onRotateStart} />
      {handles.map((handle) => (
        <div
          key={handle}
          className={`handle ${handle}`}
          onPointerDown={(event) => {
            onResizeStart(event, handle);
          }}
        />
      ))}
    </div>
  );
}

function selectionStyle(transform: Transform): CSSProperties {
  return {
    width: transform.width,
    height: transform.height,
    transform: `translate(${String(transform.x)}px, ${String(transform.y)}px) rotate(${String(transform.rotation)}deg)`
  };
}
