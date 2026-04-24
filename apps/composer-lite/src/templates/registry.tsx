import type { ComponentType, CSSProperties } from "react";
import { ArrowIcon } from "../icons";
import type {
  CodeContent,
  ComposerSurface,
  DocsContent,
  HeroContent,
  SurfaceAppearance,
  TemplateId,
  Theme
} from "../composer/types";

type TemplateProps<TContent> = Readonly<{
  theme: Theme;
  content: TContent;
  accent: string;
}>;

type TemplateDefinition<TContent> = Readonly<{
  id: TemplateId;
  name: string;
  desc: string;
  defaultSize: Readonly<{ width: number; height: number }>;
  Component: ComponentType<TemplateProps<TContent>>;
  Thumb: ComponentType;
}>;

type TemplateRegistry = Readonly<{
  hero: TemplateDefinition<HeroContent>;
  docs: TemplateDefinition<DocsContent>;
  code: TemplateDefinition<CodeContent>;
}>;

function HeroSurface({ theme, content, accent }: TemplateProps<HeroContent>) {
  return (
    <div className={`tpl-hero ${theme === "light" ? "theme-light" : ""}`}>
      <div className="inner">
        <div className="eyebrow">
          <span
            className="dot"
            style={{ background: accent, boxShadow: `0 0 10px ${accent}aa` }}
          />
          {content.eyebrow}
        </div>
        <h1 className="h1">{content.headline}</h1>
        <p className="sub">{content.subtitle}</p>
      </div>
      <div className="cta-row">
        <button
          className="cta"
          style={{
            background: accent,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.08) inset, 0 8px 24px -10px ${accent}99`
          }}
          type="button"
        >
          {content.cta} <ArrowIcon color="#fff" size={11} />
        </button>
        <button className="cta-ghost" type="button">
          View docs
        </button>
      </div>
    </div>
  );
}

function DocsSurface({ theme, content, accent }: TemplateProps<DocsContent>) {
  const themeClass =
    theme === "dark" ? "theme-dark" : theme === "grad" ? "theme-grad" : "";

  return (
    <div className={`tpl-docs ${themeClass}`}>
      <span
        className="badge"
        style={{ background: `linear-gradient(90deg, ${accent} 0%, #9b7bff 100%)` }}
      >
        {content.badge.toUpperCase()}
      </span>
      <h2>{content.title}</h2>
      <p>{content.body}</p>
      <code>{content.command}</code>
      <div className="meta">{content.meta}</div>
    </div>
  );
}

function CodeSurface({ theme, content }: TemplateProps<CodeContent>) {
  return (
    <div className={`tpl-code ${theme === "light" ? "theme-light" : ""}`}>
      <div className="tabbar">
        <div className="dots">
          <span />
          <span />
          <span />
        </div>
        <div className="file">
          <span className="lang" />
          {content.filename}
        </div>
      </div>
      <div className="body">
        <div className="ln">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <div className="src">
          <div>
            <span className="c">// compose.ts</span>
          </div>
          <div>
            <span className="k">import</span> <span className="p">{"{"}</span>{" "}
            <span className="t">CanvasRuntime</span> <span className="p">{"}"}</span>{" "}
            <span className="k">from</span>{" "}
            <span className="s">"@synthesisengineering/prism"</span>
          </div>
          <div> </div>
          <div>
            <span className="k">const</span> <span className="fn">runtime</span>{" "}
            <span className="p">=</span> <span className="k">new</span>{" "}
            <span className="t">CanvasRuntime</span>
            <span className="p">(canvas)</span>
          </div>
          <div>
            <span className="k">const</span> <span className="fn">surface</span>{" "}
            <span className="p">=</span> <span className="fn">runtime</span>
            <span className="p">.</span>
            <span className="fn">registerSurface</span>
            <span className="p">(card)</span>
          </div>
          <div> </div>
          <div>
            <span className="k">await</span> <span className="fn">runtime</span>
            <span className="p">.</span>
            <span className="fn">paintOnce</span>
            <span className="p">()</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroThumb() {
  return (
    <div className="thumb thumb-hero">
      <span />
      <i />
      <b />
    </div>
  );
}

function DocsThumb() {
  return (
    <div className="thumb thumb-docs">
      <span />
      <i />
      <b />
    </div>
  );
}

function CodeThumb() {
  return (
    <div className="thumb thumb-code">
      <span />
      <i />
      <b />
    </div>
  );
}

export const templateRegistry: TemplateRegistry = {
  hero: {
    id: "hero",
    name: "Hero",
    desc: "Headline surface",
    defaultSize: { width: 560, height: 340 },
    Component: HeroSurface,
    Thumb: HeroThumb
  },
  docs: {
    id: "docs",
    name: "Docs",
    desc: "Open source card",
    defaultSize: { width: 300, height: 380 },
    Component: DocsSurface,
    Thumb: DocsThumb
  },
  code: {
    id: "code",
    name: "Code",
    desc: "Snippet window",
    defaultSize: { width: 460, height: 260 },
    Component: CodeSurface,
    Thumb: CodeThumb
  }
};

export function SurfaceTemplate({ surface }: Readonly<{ surface: ComposerSurface }>) {
  const appearance: SurfaceAppearance = surface.appearance;
  const common = {
    theme: appearance.theme,
    accent: appearance.accent
  };

  switch (surface.template) {
    case "hero":
      return <HeroSurface {...common} content={surface.content} />;
    case "docs":
      return <DocsSurface {...common} content={surface.content} />;
    case "code":
      return <CodeSurface {...common} content={surface.content} />;
  }
}

export function surfaceStyle(
  surface: ComposerSurface,
  layerIndex: number
): CSSProperties {
  return {
    width: surface.transform.width,
    height: surface.transform.height,
    zIndex: layerIndex + 1,
    borderRadius: surface.appearance.radius,
    animationDelay: `${String(surface.enterDelay)}ms`
  };
}
