import Link from "next/link";
import { PrismDocsSidebar } from "./prism-docs-sidebar";
import { PrismTopNav } from "./prism-top-nav";

const runtimeSteps = ["registerSurface", "onPaint", "paintOnce", "cleanup"] as const;

const ownership = {
  app: ["state", "data", "templates", "transforms", "rendering decisions", "interaction state"],
  prism: [
    "CanvasRuntime",
    "surface registration",
    "paint lifecycle",
    "invalidation",
    "CSS-pixel bounds",
    "readiness",
    "cleanup"
  ]
} as const;

const pipeline = [
  ["App", "HTML element", "your DOM/JSX"],
  ["Prism", "Prism surface", "registerSurface()"],
  ["Prism", "canvas paint pass", "paintOnce()"],
  ["App", "canvas frame", "display · toBlob()"]
] as const;

const examples = [
  {
    href: "/docs/examples/prism-atlantic",
    title: "Prism Atlantic",
    body: "Real NOAA/NHC storm-track data with canvas-rendered tracks and Prism-managed HTML/CSS surfaces.",
    variant: "atlantic"
  },
  {
    href: "/docs/examples/react-composer-lite",
    title: "React Composer Lite",
    body: "React-authored components as movable, transformable, exportable Prism surfaces.",
    variant: "composer"
  },
  {
    href: "/docs/examples/pie-chart",
    title: "Pie Chart",
    body: "Minimal canvas/data example adapted from the WICG HTML-in-Canvas repo.",
    variant: "pie"
  }
] as const;

export default function HomePage() {
  return (
    <main className="prism-home">
      <PrismTopNav />

      <section className="prism-home-shell prism-home-grid">
        <PrismDocsSidebar />

        <div className="prism-home-main">
          <p className="prism-home-eyebrow">
            <span />
            runtime · built on the HTML-in-Canvas proposal
          </p>

          <div className="prism-home-hero">
            <div className="prism-home-copy">
              <h1>
                Runtime infrastructure for managed{" "}
                <span>HTML/CSS canvas surfaces</span>.
              </h1>
              <p>
                Prism builds on HTML-in-Canvas and gives apps a runtime layer
                for surface registration, paint lifecycle, coordinate
                conversion, invalidation, readiness, and cleanup.
              </p>
              <div className="prism-home-actions">
                <Link className="prism-home-button primary" href="/docs/tutorials/quickstart">
                  Quickstart <span aria-hidden="true">→</span>
                </Link>
                <Link
                  className="prism-home-button secondary"
                  href="/docs/examples/prism-atlantic"
                >
                  View examples
                </Link>
              </div>
              <pre className="prism-install-cell">
                <code>npm i @synthesisengineering/prism</code>
              </pre>
            </div>

            <div className="prism-canvas-frame" aria-label="Prism canvas surface diagram">
              <div className="prism-canvas-topbar">
                <span>&lt;canvas&gt; · 720 × 360</span>
                <span>dpr 2.0</span>
              </div>
              <div className="prism-canvas-body">
                <svg
                  aria-hidden="true"
                  className="prism-canvas-trace"
                  viewBox="0 0 720 380"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="prism-trace" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#7c5cff" stopOpacity="0" />
                      <stop offset="45%" stopColor="#7c5cff" stopOpacity="0.76" />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.78" />
                    </linearGradient>
                    <linearGradient id="prism-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,300 C120,260 200,200 320,210 C440,220 520,140 640,130 C690,128 720,150 720,150 L720,380 L0,380 Z"
                    fill="url(#prism-fill)"
                  />
                  <path
                    d="M0,300 C120,260 200,200 320,210 C440,220 520,140 640,130 C690,128 720,150 720,150"
                    fill="none"
                    stroke="url(#prism-trace)"
                    strokeWidth="2"
                  />
                </svg>
                <div className="prism-surface-card surface-title">
                  <strong>HTML title</strong>
                  <span>managed surface</span>
                </div>
                <div className="prism-surface-card surface-tooltip">
                  <strong>Tooltip</strong>
                  <span>CSS pixels · app-owned content</span>
                </div>
                <div className="prism-surface-card surface-panel">
                  <strong>Detail panel</strong>
                  <span>drawSurface(surface)</span>
                </div>
                <div className="prism-canvas-status">
                  {runtimeSteps.map((step) => (
                    <span key={step}>{step}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <section className="prism-home-section">
            <div className="prism-section-heading">
              <p>01 · Boundaries</p>
              <h2>What Prism owns</h2>
              <span>
                Prism is a runtime, not a framework. It manages surfaces, paint,
                and export timing and stays out of your render decisions.
              </span>
            </div>

            <div className="prism-owner-grid">
              <OwnerCard title="App owns" label="Userland" items={ownership.app} />
              <OwnerCard title="Prism owns" label="Runtime" items={ownership.prism} accent />
            </div>
          </section>

          <section className="prism-home-section">
            <div className="prism-section-heading">
              <p>02 · Pipeline</p>
              <h2>The surface model</h2>
              <span>
                One pass, four stages. Prism owns registration and painting;
                your code owns the source element and the final canvas frame.
              </span>
            </div>

            <div className="prism-pipeline" aria-label="Surface model pipeline">
              {pipeline.map(([owner, title, detail], index) => (
                <div
                  key={title}
                  className={owner === "Prism" ? "prism-pipeline-step prism-owned" : "prism-pipeline-step"}
                >
                  <p>
                    {String(index + 1).padStart(2, "0")} · {owner}
                  </p>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="prism-home-section">
            <div className="prism-section-heading">
              <p>03 · Reference apps</p>
              <h2>Examples</h2>
              <span>
                Three apps built on Prism. Start with the one closest to what
                you are shipping.
              </span>
            </div>

            <div className="prism-example-grid">
              {examples.map((example) => (
                <Link key={example.href} href={example.href} className="prism-example-card">
                  <ExamplePreview variant={example.variant} />
                  <h3>{example.title}</h3>
                  <p>{example.body}</p>
                  <span aria-hidden="true" className="prism-example-arrow">
                    ↗
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function OwnerCard({
  title,
  label,
  items,
  accent = false
}: {
  title: string;
  label: string;
  items: readonly string[];
  accent?: boolean;
}) {
  return (
    <div className={accent ? "prism-owner-card accent" : "prism-owner-card"}>
      <div className="prism-owner-topline" />
      <div className="prism-owner-header">
        <h3>{title}</h3>
        <span>{label}</span>
      </div>
      <ul>
        {items.map((item, index) => (
          <li key={item}>
            <span>{item}</span>
            <code>{String(index + 1).padStart(2, "0")}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExamplePreview({ variant }: { variant: (typeof examples)[number]["variant"] }) {
  if (variant === "pie") {
    return (
      <div className="prism-example-preview">
        <svg viewBox="0 0 240 110" aria-hidden="true">
          <circle cx="92" cy="56" r="30" fill="#3f3f46" />
          <path d="M92 56 L92 26 A30 30 0 0 1 118 71 Z" fill="#a78bfa" />
          <path d="M92 56 L118 71 A30 30 0 0 1 70 78 Z" fill="#22d3ee" />
          <rect x="132" y="34" width="58" height="36" rx="4" fill="#09090b" stroke="#2a2a30" />
          <rect x="138" y="42" width="8" height="6" fill="#a78bfa" />
          <rect x="138" y="52" width="8" height="6" fill="#22d3ee" />
          <rect x="138" y="62" width="8" height="6" fill="#71717a" />
        </svg>
      </div>
    );
  }

  if (variant === "composer") {
    return (
      <div className="prism-example-preview">
        <svg viewBox="0 0 240 110" aria-hidden="true">
          <rect x="35" y="26" width="68" height="42" rx="4" fill="#18181b" stroke="#a78bfa" />
          <rect x="44" y="36" width="34" height="4" rx="2" fill="#d4d4d8" />
          <rect x="44" y="46" width="46" height="4" rx="2" fill="#71717a" />
          <rect x="44" y="56" width="40" height="4" rx="2" fill="#52525b" />
          <rect x="122" y="44" width="84" height="46" rx="4" fill="#0f172a" stroke="#22d3ee" transform="rotate(-4 164 67)" />
          <circle cx="32" cy="22" r="3" fill="#a78bfa" />
          <circle cx="210" cy="91" r="3" fill="#22d3ee" />
        </svg>
      </div>
    );
  }

  return (
    <div className="prism-example-preview">
      <svg viewBox="0 0 240 110" aria-hidden="true">
        <path
          d="M16 78 C54 65 72 48 108 54 C142 60 158 76 218 36"
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2"
        />
        <path
          d="M16 86 C58 70 80 68 108 70 C142 72 162 88 218 52"
          fill="none"
          stroke="#22d3ee"
          strokeDasharray="3 4"
          strokeWidth="1.5"
        />
        <circle cx="70" cy="61" r="3" fill="#a78bfa" />
        <circle cx="120" cy="56" r="3" fill="#a78bfa" />
        <rect x="140" y="28" width="58" height="31" rx="4" fill="#09090b" stroke="#2a2a30" />
        <text x="146" y="42" fill="#fafafa" fontSize="7" fontFamily="monospace">
          FELIX · CAT 3
        </text>
      </svg>
    </div>
  );
}
