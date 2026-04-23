import { describe, expect, it } from "vitest";
import { Rect } from "./rect";

describe("Rect", () => {
  it("tests point containment", () => {
    const rect = new Rect(10, 20, 100, 50);

    expect(rect.contains({ x: 10, y: 20 })).toBe(true);
    expect(rect.contains({ x: 110, y: 70 })).toBe(true);
    expect(rect.contains({ x: 111, y: 70 })).toBe(false);
  });
});
