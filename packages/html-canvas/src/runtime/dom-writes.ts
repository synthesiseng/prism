type StyleName =
  | "position"
  | "left"
  | "top"
  | "width"
  | "height"
  | "transform"
  | "transform-origin"
  | "pointer-events";
type AttributeName = "content" | "drawable" | "aria-label" | "data-prism-surface";
type StyleValue = readonly [value: string, priority: string];
const styleNames: readonly StyleName[] = [
  "position",
  "left",
  "top",
  "width",
  "height",
  "transform",
  "transform-origin",
  "pointer-events"
];
const attributeNames: readonly AttributeName[] = [
  "content",
  "drawable",
  "aria-label",
  "data-prism-surface"
];

/** Tracks only Prism's writes; unrelated application DOM state is never restored. */
export class DomWrites {
  private readonly initialStyles = new Map<StyleName, StyleValue>();
  private readonly initialAttributes = new Map<AttributeName, string | null>();
  private readonly styles = new Map<StyleName, StyleValue>();
  private readonly attributes = new Map<AttributeName, string>();
  private readonly initialInert: boolean;
  private readonly initialStyle: string | null;
  private readonly initialCssText: string;
  private readonly normalizer: CSSStyleDeclaration;
  private lastInert: boolean | undefined;
  private closed = false;

  constructor(private readonly element: HTMLElement) {
    for (const name of styleNames) this.initialStyles.set(name, this.readStyle(name));
    for (const name of attributeNames)
      this.initialAttributes.set(name, element.getAttribute(name));
    this.initialInert = element.inert;
    this.initialStyle = element.getAttribute("style");
    this.normalizer = element.ownerDocument.createElement("div").style;
    this.normalizer.cssText = this.initialStyle ?? "";
    this.initialCssText = this.normalizer.cssText;
  }

  setStyle(name: StyleName, value: string): void {
    if (this.closed) return;
    this.normalizer.setProperty(name, value);
    // Record canonical CSS before the write: custom-element callbacks may dispose synchronously.
    this.styles.set(name, [this.normalizer.getPropertyValue(name), ""]);
    this.element.style.setProperty(name, value);
  }

  matchesStyle(name: StyleName): boolean {
    const last = this.styles.get(name);
    const current = this.readStyle(name);
    return !this.closed && last !== undefined &&
      current[0] === last[0] && current[1] === last[1];
  }

  setAttribute(name: AttributeName, value: string): void {
    if (this.closed) return;
    this.attributes.set(name, value);
    this.element.setAttribute(name, value);
  }

  setInert(value: boolean): void {
    if (this.closed) return;
    this.lastInert = value;
    this.element.inert = value;
  }

  restore(): void {
    if (this.closed) return;
    this.closed = true;
    const failures: unknown[] = [];
    const attempt = (restore: () => void) => {
      try {
        restore();
      } catch (error) {
        failures.push(error);
      }
    };
    for (const [name, last] of this.styles)
      attempt(() => {
        const current = this.readStyle(name);
        if (current[0] !== last[0] || current[1] !== last[1]) return;
        const initial = this.initialStyles.get(name)!;
        if (initial[0]) this.element.style.setProperty(name, initial[0], initial[1]);
        else this.element.style.removeProperty(name);
      });
    for (const [name, last] of this.attributes)
      attempt(() => {
        if (this.element.getAttribute(name) !== last) return;
        const initial = this.initialAttributes.get(name) ?? null;
        if (initial === null) this.element.removeAttribute(name);
        else this.element.setAttribute(name, initial);
      });
    attempt(() => {
      if (this.lastInert !== undefined && this.element.inert === this.lastInert)
        this.element.inert = this.initialInert;
    });
    attempt(() => {
      // Preserve original serialization only when all CSS is semantically back to its initial state.
      if (this.element.style.cssText === this.initialCssText) {
        if (this.initialStyle === null) this.element.removeAttribute("style");
        else this.element.setAttribute("style", this.initialStyle);
      }
    });
    if (failures.length > 0) throw failures[0];
  }

  private readStyle(name: StyleName): StyleValue {
    return [
      this.element.style.getPropertyValue(name),
      this.element.style.getPropertyPriority(name)
    ];
  }
}

const surfaceWrites = new WeakMap<HTMLElement, DomWrites>();

export function beginSurfaceWrites(element: HTMLElement): DomWrites {
  const writes = new DomWrites(element);
  surfaceWrites.set(element, writes);
  return writes;
}

export function releaseSurfaceWrites(element: HTMLElement): void {
  surfaceWrites.delete(element);
}

export function writeSurfaceStyle(
  element: HTMLElement,
  name: StyleName,
  value: string
): void {
  surfaceWrites.get(element)?.setStyle(name, value);
}

export function writeSurfaceInert(element: HTMLElement, value: boolean): void {
  surfaceWrites.get(element)?.setInert(value);
}

export function writeSurfaceAttribute(
  element: HTMLElement,
  name: AttributeName,
  value: string
): void {
  const writes = surfaceWrites.get(element);
  if (writes) writes.setAttribute(name, value);
  else element.setAttribute(name, value);
}
