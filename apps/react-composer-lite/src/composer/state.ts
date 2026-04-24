import type {
  ChangelogContent,
  ChangelogSurfaceModel,
  CodeContent,
  CodeSurfaceModel,
  ComposerSurface,
  DocsContent,
  DocsSurfaceModel,
  HeroContent,
  HeroSurfaceModel,
  InstallContent,
  InstallSurfaceModel,
  QuoteContent,
  QuoteSurfaceModel,
  StageFormat,
  StageFormatId,
  StatContent,
  StatSurfaceModel,
  TemplateId,
  WordmarkContent,
  WordmarkSurfaceModel
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

export const defaultStatContent: StatContent = {
  value: "paintOnce()",
  label: "Export path",
  sub: "fonts → paint → blob"
};

export const defaultQuoteContent: QuoteContent = {
  quote: "DOM-quality layout, canvas-native composition.",
  author: "Runtime note",
  role: "Prism library"
};

export const defaultChangelogContent: ChangelogContent = {
  version: "v0.1",
  date: "Alpha",
  items: [
    { tag: "new", text: "Canvas runtime" },
    { tag: "new", text: "Surface lifecycle" },
    { tag: "fix", text: "Paint readiness" }
  ]
};

export const defaultWordmarkContent: WordmarkContent = {
  tag: "by Synthesis"
};

export const defaultInstallContent: InstallContent = {
  badge: "v0.1",
  title: "Ship in one line.",
  command: "npm i @synthesisengineering/prism"
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
    theme: ["docs", "quote", "install"].includes(templateId) ? "light" : "dark",
    accent: "#7B61FF",
    padding: 24,
    radius: templateId === "code" ? 12 : templateId === "wordmark" ? 999 : 14,
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
    case "stat":
      return {
        id,
        template: "stat",
        transform,
        content: { ...defaultStatContent },
        appearance: { ...appearance, shadow: "deep" },
        enterDelay
      } satisfies StatSurfaceModel;
    case "quote":
      return {
        id,
        template: "quote",
        transform,
        content: { ...defaultQuoteContent },
        appearance: { ...appearance, theme: "light", shadow: "deep" },
        enterDelay
      } satisfies QuoteSurfaceModel;
    case "changelog":
      return {
        id,
        template: "changelog",
        transform,
        content: { ...defaultChangelogContent },
        appearance: { ...appearance, shadow: "deep" },
        enterDelay
      } satisfies ChangelogSurfaceModel;
    case "wordmark":
      return {
        id,
        template: "wordmark",
        transform,
        content: { ...defaultWordmarkContent },
        appearance: { ...appearance, padding: 16, shadow: "soft" },
        enterDelay
      } satisfies WordmarkSurfaceModel;
    case "install":
      return {
        id,
        template: "install",
        transform,
        content: { ...defaultInstallContent },
        appearance: { ...appearance, theme: "light", shadow: "deep" },
        enterDelay
      } satisfies InstallSurfaceModel;
  }
}

export function defaultComposition(): ComposerSurface[] {
  return [
    createSurface("wordmark", {
      x: 48,
      y: 40,
      width: 180,
      height: 60,
      rotation: -2,
      enterDelay: 0
    }),
    createSurface("hero", {
      x: 30,
      y: 130,
      width: 620,
      height: 400,
      rotation: -4,
      enterDelay: 60
    }),
    createSurface("stat", {
      x: 580,
      y: 440,
      width: 230,
      height: 150,
      rotation: 5,
      enterDelay: 120
    }),
    createSurface("changelog", {
      x: 960,
      y: 400,
      width: 220,
      height: 200,
      rotation: 4,
      enterDelay: 180
    }),
    createSurface("code", {
      x: 640,
      y: 60,
      width: 480,
      height: 290,
      rotation: 6,
      enterDelay: 240
    }),
    createSurface("quote", {
      x: 820,
      y: 280,
      width: 310,
      height: 180,
      rotation: -3,
      enterDelay: 300
    }),
    createSurface("install", {
      x: 280,
      y: 470,
      width: 310,
      height: 150,
      rotation: -2,
      enterDelay: 360
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
