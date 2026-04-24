import { useEffect, useRef } from "react";
import type { CanvasRuntime, CanvasSurface } from "@synthesisengineering/prism";
import type { ComposerSurface } from "../composer/types";

type SurfaceRegistration = Readonly<{
  runtime: CanvasRuntime | null;
  element: HTMLElement | null;
  model: ComposerSurface;
  onRegistered(id: string, surface: CanvasSurface | null): void;
}>;

export function usePrismSurface({
  runtime,
  element,
  model,
  onRegistered
}: SurfaceRegistration): void {
  const surfaceRef = useRef<CanvasSurface | null>(null);

  useEffect(() => {
    if (!runtime || !element) {
      return;
    }

    // Composer owns the serializable model; Prism owns the live DOM surface.
    // Bounds passed to Prism are CSS pixels, not backing-store pixels.
    const surface = runtime.registerSurface(element, {
      bounds: {
        x: model.transform.x,
        y: model.transform.y,
        width: model.transform.width,
        height: model.transform.height
      },
      ariaLabel: `${model.template} surface`
    });
    surfaceRef.current = surface;
    onRegistered(model.id, surface);

    return () => {
      onRegistered(model.id, null);
      surfaceRef.current = null;
      surface.dispose();
    };
  }, [element, model.id, model.template, onRegistered, runtime]);

  useEffect(() => {
    surfaceRef.current?.setBounds({
      x: model.transform.x,
      y: model.transform.y,
      width: model.transform.width,
      height: model.transform.height
    });
  }, [
    model.transform.height,
    model.transform.width,
    model.transform.x,
    model.transform.y
  ]);
}
