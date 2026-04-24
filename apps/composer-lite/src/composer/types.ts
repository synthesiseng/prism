export type StageFormatId = "og" | "square" | "portrait" | "story";

export type TemplateId = "hero" | "docs" | "code";

export type StageFormat = Readonly<{
  id: StageFormatId;
  name: string;
  ratio: string;
  width: number;
  height: number;
}>;

export type Theme = "light" | "dark" | "grad";

export type Shadow = "none" | "soft" | "deep";

export type Transform = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}>;

export type SurfaceAppearance = Readonly<{
  theme: Theme;
  accent: string;
  padding: number;
  radius: number;
  shadow: Shadow;
}>;

export type HeroContent = Readonly<{
  eyebrow: string;
  headline: string;
  subtitle: string;
  cta: string;
}>;

export type DocsContent = Readonly<{
  badge: string;
  title: string;
  body: string;
  command: string;
  meta: string;
}>;

export type CodeContent = Readonly<{
  filename: string;
}>;

type ComposerSurfaceBase<TTemplate extends TemplateId, TContent> = Readonly<{
  id: string;
  template: TTemplate;
  transform: Transform;
  content: TContent;
  appearance: SurfaceAppearance;
  enterDelay: number;
}>;

export type HeroSurfaceModel = ComposerSurfaceBase<"hero", HeroContent>;
export type DocsSurfaceModel = ComposerSurfaceBase<"docs", DocsContent>;
export type CodeSurfaceModel = ComposerSurfaceBase<"code", CodeContent>;

export type ComposerSurface = HeroSurfaceModel | DocsSurfaceModel | CodeSurfaceModel;

export type GhostSurface = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type ExportState = "idle" | "loading" | "done";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
