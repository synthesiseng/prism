export type Vec2Like = Readonly<{
  x: number;
  y: number;
}>;

export class Vec2 {
  readonly x: number;
  readonly y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static readonly zero = new Vec2(0, 0);

  add(other: Vec2Like): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vec2Like): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  scale(value: number): Vec2 {
    return new Vec2(this.x * value, this.y * value);
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }
}
