import { useState } from "react";
import { BringForwardIcon, SendBackwardIcon, SynthesisWord } from "./icons";
import type {
  ComposerSurface,
  DocsSurfaceModel,
  HeroSurfaceModel,
  StageFormat,
  TemplateId
} from "./composer/types";
import { stageFormats } from "./composer/state";
import { templateRegistry } from "./templates/registry";

type LeftPanelProps = Readonly<{
  format: StageFormat;
  onFormat(format: StageFormat): void;
  onAddTemplate(templateId: TemplateId): void;
  onGhostShow(templateId: TemplateId): void;
  onGhostHide(): void;
}>;

const accentSwatches = [
  "#7B61FF",
  "#4dd4ff",
  "#3ee07a",
  "#ffb347",
  "#ff4d6d",
  "#f0f0f0"
] as const;

export function LeftPanel({
  format,
  onFormat,
  onAddTemplate,
  onGhostShow,
  onGhostHide
}: LeftPanelProps) {
  return (
    <aside className="panel-left">
      <div className="sec">
        <h3 className="sec-title">Stage format</h3>
        <div className="format-grid">
          {Object.values(stageFormats).map((stageFormat) => (
            <button
              key={stageFormat.id}
              className={`pill ${format.id === stageFormat.id ? "active" : ""}`}
              type="button"
              onClick={() => {
                onFormat(stageFormat);
              }}
            >
              <span>{stageFormat.name}</span>
              <span className="ratio">{stageFormat.ratio}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sec">
        <h3 className="sec-title">Add surface</h3>
        <div className="tpl-list">
          {Object.values(templateRegistry).map((template) => {
            const Thumb = template.Thumb;
            return (
              <button
                key={template.id}
                className="tpl"
                type="button"
                onClick={() => {
                  onAddTemplate(template.id);
                }}
                onMouseEnter={() => {
                  onGhostShow(template.id);
                }}
                onMouseLeave={onGhostHide}
              >
                <div className="tpl-thumb">
                  <Thumb />
                </div>
                <div className="tpl-meta">
                  <span className="tpl-name">{template.name}</span>
                  <span className="tpl-desc">{template.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="wordmark">
        <SynthesisWord />
      </div>
    </aside>
  );
}

type RightPanelProps = Readonly<{
  selectedId: string | null;
  surface: ComposerSurface | null;
  onSurfaceChange(surface: ComposerSurface): void;
  bringForward(): void;
  sendBackward(): void;
}>;

export function RightPanel({
  selectedId,
  surface,
  onSurfaceChange,
  bringForward,
  sendBackward
}: RightPanelProps) {
  const [isAccentOpen, setIsAccentOpen] = useState(false);

  if (!selectedId || !surface) {
    return (
      <aside className="panel-right">
        <div className="empty-state">Select a surface to inspect.</div>
      </aside>
    );
  }

  const setAppearance = (patch: Partial<ComposerSurface["appearance"]>): void => {
    onSurfaceChange({
      ...surface,
      appearance: { ...surface.appearance, ...patch }
    });
  };

  return (
    <aside className="panel-right">
      <div className="panel-right-scroll" key={surface.id}>
        <div className="sec">
          <h3 className="sec-title">Content</h3>
          <ContentFields surface={surface} onSurfaceChange={onSurfaceChange} />
        </div>

        <div className="sec">
          <h3 className="sec-title">Appearance</h3>

          <div className="swatch-row">
            {(["light", "dark", "grad"] as const).map((theme) => (
              <button
                key={theme}
                className={`swatch swatch-${theme} ${
                  surface.appearance.theme === theme ? "active" : ""
                }`}
                type="button"
                onClick={() => {
                  setAppearance({ theme });
                }}
              >
                {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "Gradient"}
              </button>
            ))}
          </div>

          <div className="accent-row">
            <span className="accent-label">Accent</span>
            <div className={`accent-pop-wrap ${isAccentOpen ? "open" : ""}`}>
              <button
                aria-expanded={isAccentOpen}
                aria-label="Choose accent color"
                className="accent-dot"
                style={{ background: surface.appearance.accent }}
                type="button"
                onClick={() => {
                  setIsAccentOpen((isOpen) => !isOpen);
                }}
              />
              <div aria-label="Accent colors" className="accent-pop">
                {accentSwatches.map((color) => (
                  <button
                    key={color}
                    aria-label={`Use accent ${color}`}
                    style={{ background: color }}
                    type="button"
                    onClick={() => {
                      setAppearance({ accent: color });
                      setIsAccentOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="slider-row">
            <span className="slider-label">Padding</span>
            <input
              className="slider"
              max="48"
              min="8"
              step="1"
              type="range"
              value={surface.appearance.padding}
              onChange={(event) => {
                setAppearance({ padding: Number(event.currentTarget.value) });
              }}
            />
            <span className="slider-val">{surface.appearance.padding}</span>
          </div>
          <div className="slider-row">
            <span className="slider-label">Radius</span>
            <input
              className="slider"
              max="28"
              min="0"
              step="1"
              type="range"
              value={surface.appearance.radius}
              onChange={(event) => {
                setAppearance({ radius: Number(event.currentTarget.value) });
              }}
            />
            <span className="slider-val">{surface.appearance.radius}</span>
          </div>

          <div className="triplet">
            {(["none", "soft", "deep"] as const).map((shadow) => (
              <button
                key={shadow}
                className={surface.appearance.shadow === shadow ? "active" : ""}
                type="button"
                onClick={() => {
                  setAppearance({ shadow });
                }}
              >
                {shadow[0]?.toUpperCase()}
                {shadow.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="sec">
          <h3 className="sec-title">Layer</h3>
          <div className="layer-row">
            <button className="layer-btn" type="button" onClick={bringForward}>
              <BringForwardIcon size={12} /> Forward
            </button>
            <button className="layer-btn" type="button" onClick={sendBackward}>
              <SendBackwardIcon size={12} /> Backward
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ContentFields({
  surface,
  onSurfaceChange
}: Readonly<{
  surface: ComposerSurface;
  onSurfaceChange(surface: ComposerSurface): void;
}>) {
  switch (surface.template) {
    case "hero":
      return (
        <HeroFields
          surface={surface}
          onChange={(nextSurface) => {
            onSurfaceChange(nextSurface);
          }}
        />
      );
    case "docs":
      return (
        <DocsFields
          surface={surface}
          onChange={(nextSurface) => {
            onSurfaceChange(nextSurface);
          }}
        />
      );
    case "code":
      return (
        <div className="field-row">
          <input
            className="field"
            placeholder="Filename"
            value={surface.content.filename}
            onChange={(event) => {
              onSurfaceChange({
                ...surface,
                content: { filename: event.currentTarget.value }
              });
            }}
          />
        </div>
      );
  }
}

function HeroFields({
  surface,
  onChange
}: Readonly<{
  surface: HeroSurfaceModel;
  onChange(surface: HeroSurfaceModel): void;
}>) {
  const setContent = (patch: Partial<HeroSurfaceModel["content"]>): void => {
    onChange({ ...surface, content: { ...surface.content, ...patch } });
  };

  return (
    <>
      <div className="field-row">
        <input
          className="field"
          placeholder="Eyebrow"
          value={surface.content.eyebrow}
          onChange={(event) => {
            setContent({ eyebrow: event.currentTarget.value });
          }}
        />
      </div>
      <div className="field-row">
        <textarea
          className="field field-multi"
          placeholder="Headline"
          value={surface.content.headline}
          onChange={(event) => {
            setContent({ headline: event.currentTarget.value });
          }}
        />
      </div>
      <div className="field-row">
        <textarea
          className="field field-multi"
          placeholder="Subtitle"
          value={surface.content.subtitle}
          onChange={(event) => {
            setContent({ subtitle: event.currentTarget.value });
          }}
        />
      </div>
      <div className="field-row">
        <input
          className="field"
          placeholder="CTA label"
          value={surface.content.cta}
          onChange={(event) => {
            setContent({ cta: event.currentTarget.value });
          }}
        />
      </div>
    </>
  );
}

function DocsFields({
  surface,
  onChange
}: Readonly<{
  surface: DocsSurfaceModel;
  onChange(surface: DocsSurfaceModel): void;
}>) {
  const setContent = (patch: Partial<DocsSurfaceModel["content"]>): void => {
    onChange({ ...surface, content: { ...surface.content, ...patch } });
  };

  return (
    <>
      <div className="field-row">
        <input
          className="field"
          placeholder="Badge"
          value={surface.content.badge}
          onChange={(event) => {
            setContent({ badge: event.currentTarget.value });
          }}
        />
      </div>
      <div className="field-row">
        <input
          className="field"
          placeholder="Title"
          value={surface.content.title}
          onChange={(event) => {
            setContent({ title: event.currentTarget.value });
          }}
        />
      </div>
      <div className="field-row">
        <textarea
          className="field field-multi"
          placeholder="Body"
          value={surface.content.body}
          onChange={(event) => {
            setContent({ body: event.currentTarget.value });
          }}
        />
      </div>
      <div className="field-row">
        <input
          className="field"
          placeholder="Install command"
          value={surface.content.command}
          onChange={(event) => {
            setContent({ command: event.currentTarget.value });
          }}
        />
      </div>
      <div className="field-row">
        <input
          className="field"
          placeholder="Meta"
          value={surface.content.meta}
          onChange={(event) => {
            setContent({ meta: event.currentTarget.value });
          }}
        />
      </div>
    </>
  );
}
