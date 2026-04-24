import { useEffect, useState } from "react";
import { CanvasRuntime } from "@synthesisengineering/prism";

export function usePrismRuntime(canvas: HTMLCanvasElement | null): CanvasRuntime | null {
  const [runtime, setRuntime] = useState<CanvasRuntime | null>(null);

  useEffect(() => {
    if (!canvas) {
      setRuntime(null);
      return;
    }

    // Keep runtime ownership in one hook so app components never coordinate raw
    // HTML-in-Canvas browser APIs directly.
    const nextRuntime = new CanvasRuntime(canvas, { backend: "auto" });
    setRuntime(nextRuntime);

    return () => {
      setRuntime(null);
      nextRuntime.destroy();
    };
  }, [canvas]);

  return runtime;
}
