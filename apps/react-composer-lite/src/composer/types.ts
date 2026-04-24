export type StageFormatId = "og" | "square" | "portrait" | "story";

export type TemplateId =
  | "hero"
  | "docs"
  | "code"
  | "stat"
  | "quote"
  | "changelog"
  | "install"
  | "wordmark";

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

export type StatContent = Readonly<{
  value: string;
  label: string;
  sub: string;
}>;

export type QuoteContent = Readonly<{
  quote: string;
  author: string;
  role: string;
}>;

export type ChangelogItem = Readonly<{
  tag: "new" | "fix" | "imp";
  text: string;
}>;

export type ChangelogContent = Readonly<{
  version: string;
  date: string;
  items: readonly ChangelogItem[];
}>;

export type WordmarkContent = Readonly<{
  tag: string;
}>;

export type InstallContent = Readonly<{
  badge: string;
  title: string;
  command: string;
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
export type StatSurfaceModel = ComposerSurfaceBase<"stat", StatContent>;
export type QuoteSurfaceModel = ComposerSurfaceBase<"quote", QuoteContent>;
export type ChangelogSurfaceModel = ComposerSurfaceBase<"changelog", ChangelogContent>;
export type InstallSurfaceModel = ComposerSurfaceBase<"install", InstallContent>;
export type WordmarkSurfaceModel = ComposerSurfaceBase<"wordmark", WordmarkContent>;

export type ComposerSurface =
  | HeroSurfaceModel
  | DocsSurfaceModel
  | CodeSurfaceModel
  | StatSurfaceModel
  | QuoteSurfaceModel
  | ChangelogSurfaceModel
  | InstallSurfaceModel
  | WordmarkSurfaceModel;

export type GhostSurface = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type ExportState = "idle" | "loading" | "done";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
