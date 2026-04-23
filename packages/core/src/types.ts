export type FrameTime = Readonly<{
  now: number;
  delta: number;
  frame: number;
}>;

export interface EngineSystem {
  start?(): void;
  stop?(): void;
  update?(time: FrameTime): void;
  render?(time: FrameTime): void;
}
