import type { EngineSystem, FrameTime } from "@prism/core";
import type { SceneEntity } from "./entity";

export class Scene implements EngineSystem {
  private readonly entities: SceneEntity[] = [];

  add(entity: SceneEntity): this {
    this.entities.push(entity);
    return this;
  }

  update(time: FrameTime): void {
    for (const entity of this.entities) {
      entity.update?.(time);
    }
  }

  render(): void {
    for (const entity of this.entities) {
      entity.render?.();
    }
  }
}
