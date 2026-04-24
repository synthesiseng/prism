import type {
  CodeContent,
  CodeSurfaceModel,
  ComposerSurface,
  DocsContent,
  DocsSurfaceModel,
  HeroContent,
  HeroSurfaceModel,
  StageFormat,
  StageFormatId,
  TemplateId
} from "./types";
import { templateRegistry } from "../templates/registry";

export const stageFormats = {
  og: { id: "og", name: "OG", ratio: "1200x630", width: 1200, height: 630 },
  square: {
    id: "square",
    name: "Square",
    ratio: "1080x1080",
    width: 1080,
    height: 1080
  },
  portrait: {
    id: "portrait",
    name: "Portrait",
    ratio: "1080x1350",
    width: 1080,
    height: 1350
  },
  story: {
    id: "story",
    name: "Story",
    ratio: "1080x1920",
    width: 1080,
    height: 1920
  }
} as const satisfies Record<StageFormatId, StageFormat>;

export const defaultHeroContent: HeroContent = {
  eyebrow: "NEW · Announcement",
  headline: "HTML/CSS surfaces,\ncomposed on canvas.",
  subtitle:
    "Prism is an open-source TypeScript library for managed HTML-in-Canvas surfaces.",
  cta: "Get started"
};

export const defaultDocsContent: DocsContent = {
  badge: "MIT",
  title: "Open source runtime",
  body: "Native-first HTML-in-Canvas for managed HTML/CSS surfaces.",
  command: "pnpm add @synthesisengineering/prism",
  meta: "GitHub · Docs · Community"
};

export const defaultCodeContent: CodeContent = {
  filename: "prism.config.ts"
};

export function createSurface(
  templateId: TemplateId,
  options: Partial<ComposerSurface["transform"]> &
    Partial<Pick<ComposerSurface, "enterDelay">> = {}
): ComposerSurface {
  const template = templateRegistry[templateId];
  const transform = {
    x: options.x ?? 100,
    y: options.y ?? 100,
    width: options.width ?? template.defaultSize.width,
    height: options.height ?? template.defaultSize.height,
    rotation: options.rotation ?? 0
  };
  const appearance = {
    theme: templateId === "docs" ? "light" : "dark",
    accent: "#7B61FF",
    padding: 24,
    radius: templateId === "code" ? 12 : 14,
    shadow: "soft"
  } as const;
  const enterDelay = options.enterDelay ?? 0;
  const id = crypto.randomUUID();

  switch (templateId) {
    case "hero":
      return {
        id,
        template: "hero",
        transform,
        content: { ...defaultHeroContent },
        appearance: { ...appearance, shadow: "deep" },
        enterDelay
      } satisfies HeroSurfaceModel;
    case "docs":
      return {
        id,
        template: "docs",
        transform,
        content: { ...defaultDocsContent },
        appearance: { ...appearance, theme: "light", shadow: "deep" },
        enterDelay
      } satisfies DocsSurfaceModel;
    case "code":
      return {
        id,
        template: "code",
        transform,
        content: { ...defaultCodeContent },
        appearance: { ...appearance, shadow: "deep" },
        enterDelay
      } satisfies CodeSurfaceModel;
  }
}

export function defaultComposition(): ComposerSurface[] {
  return [
    createSurface("hero", {
      x: 60,
      y: 145,
      width: 640,
      height: 340,
      rotation: -2,
      enterDelay: 0
    }),
    createSurface("docs", {
      x: 760,
      y: 50,
      width: 280,
      height: 330,
      rotation: 3,
      enterDelay: 150
    }),
    createSurface("code", {
      x: 720,
      y: 340,
      width: 430,
      height: 250,
      rotation: -1.5,
      enterDelay: 300
    })
  ];
}

export function moveLayer(
  surfaces: readonly ComposerSurface[],
  selectedId: string | null,
  direction: "forward" | "backward"
): ComposerSurface[] {
  const index = surfaces.findIndex((surface) => surface.id === selectedId);
  const targetIndex = direction === "forward" ? index + 1 : index - 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= surfaces.length) {
    return [...surfaces];
  }

  const next = [...surfaces];
  const selected = next[index];
  const target = next[targetIndex];
  if (!selected || !target) {
    return next;
  }

  next[index] = target;
  next[targetIndex] = selected;
  return next;
}

export function bringSurfaceToFront(
  surfaces: readonly ComposerSurface[],
  selectedId: string
): ComposerSurface[] {
  const index = surfaces.findIndex((surface) => surface.id === selectedId);

  if (index < 0 || index === surfaces.length - 1) {
    return [...surfaces];
  }

  const next = [...surfaces];
  const selected = next[index];
  if (!selected) {
    return next;
  }

  next.splice(index, 1);
  next.push(selected);
  return next;
}
