import type { CanvasRuntime } from "@synthesisengineering/prism";
import { paletteNames, palettes, applyPalette } from "../atelier/palettes";
import {
  randomizeState,
  setMode,
  setPalette,
  setSource
} from "../atelier/state";
import type { AtelierState, ModeKind, PaletteName, SourceKind } from "../atelier/types";
import { updateTypeSurface } from "../prism/surfaces";

type ControlsOptions = Readonly<{
  runtime: CanvasRuntime;
  state: AtelierState;
  onExport(): void;
}>;

export function attachControls({ runtime, state, onExport }: ControlsOptions): void {
  const paletteTag = getElement("paletteTag") as HTMLButtonElement;
  const paletteLabel = getElement("paletteLabel");
  const paletteSwatches = getElement("paletteSwatches");
  const randomize = getElement("randomize") as HTMLButtonElement;
  const exportButton = getElement("export") as HTMLButtonElement;
  const typeInput = getElement("typeInput") as HTMLInputElement;

  const updatePressed = (): void => {
    document.querySelectorAll<HTMLButtonElement>("[data-source]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.source === state.source ? "true" : "false");
    });
    document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.mode === state.mode ? "true" : "false");
    });
  };

  const updatePalette = (): void => {
    const palette = palettes[state.paletteName];
    applyPalette(state.paletteName);
    paletteLabel.textContent = state.paletteName;
    const swatches = Array.from(paletteSwatches.querySelectorAll<HTMLElement>("i"));
    [palette.a, palette.b, palette.c].forEach((color, index) => {
      const swatch = swatches[index];
      if (swatch) {
        swatch.style.background = color;
      }
    });
  };

  document.querySelectorAll<HTMLButtonElement>("[data-source]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = button.dataset.source as SourceKind | undefined;
      if (!source) {
        return;
      }
      setSource(state, source);
      updatePressed();
      runtime.invalidate();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode as ModeKind | undefined;
      if (!mode) {
        return;
      }
      setMode(state, mode);
      updatePressed();
      runtime.invalidate();
    });
  });

  typeInput.addEventListener("input", () => {
    state.word = sanitizeWord(typeInput.value);
    typeInput.value = state.word;
    updateTypeSurface(state.word);
    runtime.invalidate();
  });
  typeInput.addEventListener("keydown", (event) => event.stopPropagation());

  paletteTag.addEventListener("click", () => {
    const current = paletteNames.indexOf(state.paletteName);
    const next = paletteNames[(current + 1) % paletteNames.length] ?? "VOID";
    setPalette(state, next);
    updatePalette();
    runtime.invalidate();
  });

  randomize.addEventListener("click", () => {
    let next: PaletteName = state.paletteName;
    while (next === state.paletteName && paletteNames.length > 1) {
      next = paletteNames[Math.floor(Math.random() * paletteNames.length)] ?? "VOID";
    }
    randomizeState(state, next);
    updatePalette();
    flash(next);
    randomize.classList.remove("spin");
    void randomize.offsetWidth;
    randomize.classList.add("spin");
    runtime.invalidate();
  });

  exportButton.addEventListener("click", onExport);

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return;
    }
    const sourceMap: Partial<Record<string, SourceKind>> = {
      "1": "glyph",
      "2": "type",
      "3": "css",
      "4": "pattern"
    };
    const modeMap: Partial<Record<string, ModeKind>> = {
      q: "extrude",
      w: "orbit",
      e: "trail",
      r: "split",
      t: "grid"
    };
    if (event.key === " ") {
      event.preventDefault();
      randomize.click();
    }
    if (event.key === "p" || event.key === "P") {
      onExport();
    }
    const source = sourceMap[event.key];
    if (source) {
      setSource(state, source);
      updatePressed();
      runtime.invalidate();
    }
    const mode = modeMap[event.key.toLowerCase()];
    if (mode) {
      setMode(state, mode);
      updatePressed();
      runtime.invalidate();
    }
  });

  updateTypeSurface(state.word);
  updatePalette();
  updatePressed();
}

function sanitizeWord(value: string): string {
  const word = value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 16);
  return word.length > 0 ? word : "SURFACE";
}

function flash(paletteName: PaletteName): void {
  const flashElement = getElement("flash");
  flashElement.style.background = palettes[paletteName].a;
  flashElement.classList.remove("go");
  void flashElement.offsetWidth;
  flashElement.classList.add("go");
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element;
}
