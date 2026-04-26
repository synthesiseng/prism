import type { AtelierState, ModeKind, PaletteName, SourceKind } from "./types";

export function createInitialState(): AtelierState {
  return {
    source: "glyph",
    mode: "extrude",
    paletteName: "VOID",
    word: "SURFACE",
    glyphShape: "diamond",
    cssStyle: "radial",
    patternStyle: "dots",
    seed: Math.floor(Math.random() * 9999),
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
    sx: 0,
    sy: 0,
    time: 0,
    morph: 1,
    burst: 1,
    fps: 60,
    frameCount: 0,
    fpsTime: 0,
    lastPointerAt: 0,
    pointerTrail: []
  };
}

export function setSource(state: AtelierState, source: SourceKind): void {
  if (state.source === source) {
    return;
  }
  state.source = source;
  state.morph = 0;
}

export function setMode(state: AtelierState, mode: ModeKind): void {
  if (state.mode === mode) {
    return;
  }
  state.mode = mode;
  state.morph = 0;
}

export function setPalette(state: AtelierState, paletteName: PaletteName): void {
  state.paletteName = paletteName;
  state.morph = Math.min(state.morph, 0.35);
}

export function randomizeState(state: AtelierState, paletteName: PaletteName): void {
  state.seed = Math.floor(Math.random() * 9999);
  state.paletteName = paletteName;
  state.burst = 0;
  state.morph = 0;
}

export function updateFrameState(state: AtelierState, delta: number): void {
  state.time += delta;
  const ease = 0.1;
  state.sx += (state.tx - state.sx) * ease;
  state.sy += (state.ty - state.sy) * ease;

  if (performance.now() - state.lastPointerAt > 1400) {
    state.tx = Math.sin(state.time * 0.32) * 0.18;
    state.ty = Math.cos(state.time * 0.21) * 0.12;
  }

  state.pointerTrail = state.pointerTrail
    .map((sample) => ({ ...sample, age: sample.age + delta }))
    .filter((sample) => sample.age < 1.2)
    .slice(0, 32);

  if (state.morph < 1) {
    state.morph = Math.min(1, state.morph + delta * 2.4);
  }
  if (state.burst < 1) {
    state.burst = Math.min(1, state.burst + delta * 1.6);
  }

  state.frameCount += 1;
  state.fpsTime += delta;
  if (state.fpsTime > 0.5) {
    state.fps = Math.round(state.frameCount / state.fpsTime);
    state.frameCount = 0;
    state.fpsTime = 0;
  }
}
