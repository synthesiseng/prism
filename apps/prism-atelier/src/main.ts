import "./styles.css";
import { attachAtelierInput } from "./atelier/input";
import { palettes } from "./atelier/palettes";
import { renderAtelierFrame, type RenderReadout } from "./atelier/render";
import { createInitialState, updateFrameState } from "./atelier/state";
import { exportCanvasPng } from "./prism/export";
import { createAtelierRuntime } from "./prism/runtime";
import {
  disposeAtelierSurfaces,
  registerAtelierSurfaces,
  sourceMetrics
} from "./prism/surfaces";
import { attachControls } from "./ui/controls";
import { hideNativeGate, showNativeGate } from "./ui/nativeGate";

const canvas = getElement("atelier-canvas") as HTMLCanvasElement;
const stage = getElement("stage");
const meta = getElement("meta");
const toolbar = getElement("toolbar");
const exportButton = getElement("export") as HTMLButtonElement;
const hint = getElement("hint");
const state = createInitialState();
const runtime = createAtelierRuntime(canvas);
let running = false;

// dev-only probe for to check the backend mode
declare global {
  interface Window {
    prismRuntime?: typeof runtime;
    __lastAtelierReadout?: RenderReadout;
  }
}

if (import.meta.env.DEV) {
  window.prismRuntime = runtime;
  console.info("[Prism] backend:", runtime.backendKind);
}

window.addEventListener("beforeunload", () => {
  // Destroying the runtime restores Prism-owned DOM/canvas state on page exit.
  running = false;
  runtime.destroy();
});

if (runtime.backendKind !== "native") {
  // Atelier depends on native DOM rendering into canvas. Fallback mode is useful
  // for lifecycle tests, but it is not visually equivalent for this example.
  showNativeGate();
  toolbar.classList.add("exporting");
} else {
  hideNativeGate();
  const surfaces = registerAtelierSurfaces(runtime);
  window.addEventListener("pagehide", () => {
    // Keep the registered source nodes' lifecycle explicit for readers copying
    // this example into an app with mounts/unmounts.
    running = false;
    disposeAtelierSurfaces(surfaces);
    runtime.destroy();
  }, { once: true });
  let last = performance.now();
  let lastReadout = { draws: 0, source: state.source, mode: state.mode };

  runtime.onPaint(({ drawSurface }) => {
    // The app owns composition. Prism provides drawSurface(), which paints the
    // selected DOM-authored source at whatever canvas transform is active.
    lastReadout = renderAtelierFrame(runtime, surfaces, sourceMetrics, state, drawSurface);
    if (import.meta.env.DEV) {
      window.__lastAtelierReadout = lastReadout;
    }
  });

  attachAtelierInput(stage, runtime, state, () => {
    hint.classList.add("fade");
  });

  attachControls({
    runtime,
    state,
    onExport: () => {
      void exportCurrentPng();
    }
  });

  const tick = (now: number): void => {
    if (!running) {
      return;
    }
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateFrameState(state, delta);
    runtime.invalidate();
    meta.textContent = `1 DOM SURFACE · ${String(lastReadout.draws)} CANVAS DRAWS · ${lastReadout.source.toUpperCase()} / ${lastReadout.mode.toUpperCase()} · ${String(state.fps)}FPS`;
    requestAnimationFrame(tick);
  };

  running = true;
  runtime.start();
  requestAnimationFrame((now) => {
    last = now;
    tick(now);
  });
}

async function exportCurrentPng(): Promise<void> {
  if (exportButton.classList.contains("exporting")) {
    return;
  }
  exportButton.classList.add("exporting");
  toolbar.classList.add("exporting");
  try {
    await exportCanvasPng(
      runtime,
      `prism_atelier_${state.source}_${state.mode}_${state.paletteName.toLowerCase()}_${String(state.seed).padStart(4, "0")}.png`
    );
    exportButton.classList.add("done");
  } finally {
    exportButton.classList.remove("exporting");
    setTimeout(() => {
      exportButton.classList.remove("done");
      toolbar.classList.remove("exporting");
    }, 600);
  }
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element;
}

document.documentElement.style.setProperty("--pal-bg", palettes[state.paletteName].bg);
