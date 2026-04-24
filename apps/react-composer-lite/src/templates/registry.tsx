import type { ComponentType, CSSProperties } from "react";
import { ArrowIcon, PrismMark } from "../icons";
import type {
  ChangelogContent,
  CodeContent,
  ComposerSurface,
  DocsContent,
  HeroContent,
  InstallContent,
  QuoteContent,
  SurfaceAppearance,
  StatContent,
  TemplateId,
  Theme,
  WordmarkContent
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
  stat: TemplateDefinition<StatContent>;
  quote: TemplateDefinition<QuoteContent>;
  changelog: TemplateDefinition<ChangelogContent>;
  install: TemplateDefinition<InstallContent>;
  wordmark: TemplateDefinition<WordmarkContent>;
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
            <span className="c">// Register real HTML as a canvas surface.</span>
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

function StatSurface({ theme, content, accent }: TemplateProps<StatContent>) {
  return (
    <div className={`tpl-stat ${theme === "light" ? "theme-light" : ""}`}>
      <div className="stat-label">{content.label}</div>
      <div className="stat-value" style={{ color: accent }}>
        {content.value}
      </div>
      <div className="stat-sub">{content.sub}</div>
      <svg
        aria-hidden
        className="stat-sparkline"
        preserveAspectRatio="none"
        viewBox="0 0 100 30"
      >
        <polyline
          fill="none"
          opacity="0.9"
          points="0,22 12,18 24,21 36,14 48,16 60,10 72,12 84,6 100,8"
          stroke={accent}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <polyline
          fill={accent}
          opacity="0.08"
          points="0,22 12,18 24,21 36,14 48,16 60,10 72,12 84,6 100,8 100,30 0,30"
        />
      </svg>
    </div>
  );
}

function QuoteSurface({ theme, content }: TemplateProps<QuoteContent>) {
  return (
    <div className={`tpl-quote ${theme === "light" ? "theme-light" : ""}`}>
      <svg aria-hidden className="quote-mark" fill="none" viewBox="0 0 28 20">
        <path
          d="M0 20V12C0 5.4 3.6 1.2 10 0L11 3C7 4 5 6 5 10H10V20H0ZM17 20V12C17 5.4 20.6 1.2 27 0L28 3C24 4 22 6 22 10H27V20H17Z"
          fill="currentColor"
          opacity="0.18"
        />
      </svg>
      <p className="quote-text">{content.quote}</p>
      <div className="quote-author">
        <div className="quote-avatar" />
        <div className="quote-meta">
          <div className="quote-name">{content.author}</div>
          <div className="quote-role">{content.role}</div>
        </div>
      </div>
    </div>
  );
}

function ChangelogSurface({ theme, content, accent }: TemplateProps<ChangelogContent>) {
  return (
    <div className={`tpl-changelog ${theme === "light" ? "theme-light" : ""}`}>
      <div className="cl-head">
        <div className="cl-version">{content.version}</div>
        <div className="cl-date">{content.date}</div>
      </div>
      <ul className="cl-list">
        {content.items.map((item) => (
          <li key={`${item.tag}-${item.text}`}>
            <span
              className={`cl-tag cl-tag-${item.tag}`}
              style={
                item.tag === "new"
                  ? {
                      background: `${accent}22`,
                      borderColor: `${accent}44`,
                      color: accent
                    }
                  : undefined
              }
            >
              {item.tag}
            </span>
            <span className="cl-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WordmarkSurface({ content }: TemplateProps<WordmarkContent>) {
  return (
    <div className="tpl-wordmark">
      <PrismMark size={28} />
      <div className="wm-text">
        <div className="wm-brand">Prism</div>
        <div className="wm-tag">{content.tag}</div>
      </div>
    </div>
  );
}

function InstallSurface({ theme, content, accent }: TemplateProps<InstallContent>) {
  const themeClass =
    theme === "dark" ? "theme-dark" : theme === "grad" ? "theme-grad" : "";

  return (
    <div className={`tpl-install ${themeClass}`}>
      <span
        className="badge"
        style={{ background: `linear-gradient(90deg, ${accent} 0%, #9b7bff 100%)` }}
      >
        {content.badge}
      </span>
      <h2>{content.title}</h2>
      <code>
        <span className="prompt">$</span>
        <span>{content.command}</span>
      </code>
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

function StatThumb() {
  return (
    <div className="thumb thumb-stat">
      <span />
      <i />
      <b />
    </div>
  );
}

function QuoteThumb() {
  return (
    <div className="thumb thumb-quote">
      <span />
      <i />
      <b />
    </div>
  );
}

function ChangelogThumb() {
  return (
    <div className="thumb thumb-changelog">
      <span />
      <i />
      <b />
    </div>
  );
}

function WordmarkThumb() {
  return (
    <div className="thumb thumb-wordmark">
      <span />
      <i />
      <b />
    </div>
  );
}

function InstallThumb() {
  return (
    <div className="thumb thumb-install">
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
  },
  stat: {
    id: "stat",
    name: "Stat",
    desc: "Metric callout",
    defaultSize: { width: 240, height: 170 },
    Component: StatSurface,
    Thumb: StatThumb
  },
  quote: {
    id: "quote",
    name: "Quote",
    desc: "Testimonial",
    defaultSize: { width: 340, height: 200 },
    Component: QuoteSurface,
    Thumb: QuoteThumb
  },
  changelog: {
    id: "changelog",
    name: "Changelog",
    desc: "Release notes",
    defaultSize: { width: 300, height: 240 },
    Component: ChangelogSurface,
    Thumb: ChangelogThumb
  },
  install: {
    id: "install",
    name: "Install",
    desc: "Command card",
    defaultSize: { width: 310, height: 150 },
    Component: InstallSurface,
    Thumb: InstallThumb
  },
  wordmark: {
    id: "wordmark",
    name: "Wordmark",
    desc: "Logo badge",
    defaultSize: { width: 180, height: 64 },
    Component: WordmarkSurface,
    Thumb: WordmarkThumb
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
    case "stat":
      return <StatSurface {...common} content={surface.content} />;
    case "quote":
      return <QuoteSurface {...common} content={surface.content} />;
    case "changelog":
      return <ChangelogSurface {...common} content={surface.content} />;
    case "install":
      return <InstallSurface {...common} content={surface.content} />;
    case "wordmark":
      return <WordmarkSurface {...common} content={surface.content} />;
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
