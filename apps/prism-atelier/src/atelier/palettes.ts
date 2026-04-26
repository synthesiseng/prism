import type { Palette, PaletteName } from "./types";

export const palettes: Record<PaletteName, Palette> = {
  VOID: { name: "VOID", bg: "#07070a", a: "#7c5cff", b: "#5dd6ff", c: "#ffffff", glow: 0.85 },
  NEON: { name: "NEON", bg: "#0a0410", a: "#ff3b6b", b: "#3bf0d9", c: "#ffe45e", glow: 1 },
  MONO: { name: "MONO", bg: "#000000", a: "#ffffff", b: "#cfcfcf", c: "#888888", glow: 0.6 },
  DUSK: { name: "DUSK", bg: "#180a1f", a: "#7a2cff", b: "#ff6b6b", c: "#ffb38a", glow: 0.95 },
  SOLAR: { name: "SOLAR", bg: "#0d0805", a: "#ffb13b", b: "#ffd96b", c: "#ff5e2c", glow: 0.95 }
};

export const paletteNames = Object.keys(palettes) as PaletteName[];

export function applyPalette(name: PaletteName): void {
  const palette = palettes[name];
  const root = document.documentElement;
  root.style.setProperty("--pal-bg", palette.bg);
  root.style.setProperty("--pal-a", palette.a);
  root.style.setProperty("--pal-b", palette.b);
  root.style.setProperty("--pal-c", palette.c);
}
