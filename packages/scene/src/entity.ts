import type { FrameTime } from "@prism/core";

export interface SceneEntity {
  update?(time: FrameTime): void;
  render?(): void;
}
