import type { CanvasRuntime } from "@synthesisengineering/prism";
import { paletteNames, palettes, applyPalette } from "../atelier/palettes";
import {
  randomizeState,
  setMode,
  setPalette,
  setSource
} from "../atelier/state";
import type { AtelierState, ModeKind, PaletteName, SourceKind } from "../atelier/types";
import {
  updateCssSurface,
  updateGlyphSurface,
  updatePatternSurface,
  updateTypeSurface
} from "../prism/surfaces";

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
  const subbar = getElement("subbar");

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
      renderSubbar();
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
      renderSubbar();
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
  updateGlyphSurface(state.glyphShape);
  updateCssSurface(state.cssStyle);
  updatePatternSurface(state.patternStyle);
  updatePalette();
  updatePressed();
  renderSubbar();

  function renderSubbar(): void {
    subbar.innerHTML = subbarMarkup(state);
    subbar.classList.remove("show");
    void subbar.offsetWidth;
    subbar.classList.add("show");

    subbar.querySelectorAll<HTMLButtonElement>("[data-glyph]").forEach((button) => {
      button.addEventListener("click", () => {
        const shape = button.dataset.glyph;
        if (!isGlyphShape(shape)) {
          return;
        }
        state.glyphShape = shape;
        state.morph = 0;
        updateGlyphSurface(shape);
        renderSubbar();
        runtime.invalidate();
      });
    });

    subbar.querySelectorAll<HTMLButtonElement>("[data-css]").forEach((button) => {
      button.addEventListener("click", () => {
        const cssStyle = button.dataset.css;
        if (!isCssStyle(cssStyle)) {
          return;
        }
        state.cssStyle = cssStyle;
        state.morph = 0;
        updateCssSurface(cssStyle);
        renderSubbar();
        runtime.invalidate();
      });
    });

    subbar.querySelectorAll<HTMLButtonElement>("[data-pattern]").forEach((button) => {
      button.addEventListener("click", () => {
        const patternStyle = button.dataset.pattern;
        if (!isPatternStyle(patternStyle)) {
          return;
        }
        state.patternStyle = patternStyle;
        state.morph = 0;
        updatePatternSurface(patternStyle);
        renderSubbar();
        runtime.invalidate();
      });
    });

    const typeInput = subbar.querySelector<HTMLInputElement>("#typeInput");
    if (typeInput) {
      typeInput.addEventListener("input", () => {
        state.word = sanitizeWord(typeInput.value);
        typeInput.value = state.word;
        updateTypeSurface(state.word);
        runtime.invalidate();
      });
      typeInput.addEventListener("keydown", (event) => event.stopPropagation());
    }
  }
}

function subbarMarkup(state: AtelierState): string {
  switch (state.source) {
    case "glyph":
      return glyphOptions
        .map((option) => subChip("glyph", option.value, option.icon, state.glyphShape === option.value))
        .join("");
    case "type":
      return `<span class="input-wrap"><input class="text-input" id="typeInput" type="text" maxlength="16" placeholder="type anything..." value="${escapeAttribute(state.word)}" autocomplete="off" spellcheck="false" /><span class="blink"></span></span>`;
    case "css":
      return cssOptions
        .map((value) => subChip("css", value, value.toUpperCase(), state.cssStyle === value))
        .join("");
    case "pattern":
      return patternOptions
        .map((value) => subChip("pattern", value, value.toUpperCase(), state.patternStyle === value))
        .join("");
  }
}

function subChip(kind: "glyph" | "css" | "pattern", value: string, content: string, pressed: boolean): string {
  return `<button class="sub-chip" type="button" data-${kind}="${value}" aria-pressed="${String(pressed)}" aria-label="${value}">${content}</button>`;
}

const glyphOptions = [
  { value: "diamond", icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.5 14.5 8 8 14.5 1.5 8Z"/></svg>' },
  { value: "triangle", icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2 14 13 2 13Z"/></svg>' },
  { value: "circle", icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6"/></svg>' },
  { value: "star", icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 1.5 9.8 6.2 14.5 6.5 10.8 9.4 12.1 14 8 11.4 3.9 14 5.2 9.4 1.5 6.5 6.2 6.2Z"/></svg>' },
  { value: "cross", icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 2 V14 M2 8 H14"/></svg>' },
  { value: "hexagon", icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.8 14 5.2 14 10.8 8 14.2 2 10.8 2 5.2Z"/></svg>' }
] as const;

const cssOptions = ["radial", "linear", "blob"] as const;
const patternOptions = ["dots", "lines", "grid"] as const;

function sanitizeWord(value: string): string {
  const word = value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 16);
  return word.length > 0 ? word : "PRISM";
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function isGlyphShape(value: string | undefined): value is AtelierState["glyphShape"] {
  return glyphOptions.some((option) => option.value === value);
}

function isCssStyle(value: string | undefined): value is AtelierState["cssStyle"] {
  return cssOptions.some((option) => option === value);
}

function isPatternStyle(value: string | undefined): value is AtelierState["patternStyle"] {
  return patternOptions.some((option) => option === value);
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
