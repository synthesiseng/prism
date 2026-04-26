export type SourceKind = "glyph" | "type" | "css" | "pattern";

export type ModeKind = "extrude" | "orbit" | "trail" | "split" | "grid";

export type PaletteName = "VOID" | "NEON" | "MONO" | "DUSK" | "SOLAR";

export type Palette = Readonly<{
  name: PaletteName;
  bg: string;
  a: string;
  b: string;
  c: string;
  glow: number;
}>;

export type PointerSample = Readonly<{
  x: number;
  y: number;
  age: number;
}>;

export type AtelierState = {
  source: SourceKind;
  mode: ModeKind;
  paletteName: PaletteName;
  word: string;
  seed: number;
  px: number;
  py: number;
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  time: number;
  morph: number;
  burst: number;
  fps: number;
  frameCount: number;
  fpsTime: number;
  lastPointerAt: number;
  pointerTrail: PointerSample[];
};

export type SourceMetrics = Readonly<Record<SourceKind, Readonly<{ width: number; height: number }>>>;
