"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const searchItems = [
  ["Introduction", "/docs/tutorials/introduction", "Prism runtime layer and current scope"],
  ["Quickstart", "/docs/tutorials/quickstart", "Install Prism and draw one HTML surface"],
  ["Installation", "/docs/tutorials/installation", "Package install and browser flags"],
  ["Mental Model", "/docs/tutorials/mental-model", "What Prism owns and what apps own"],
  ["CanvasRuntime", "/docs/explanation/canvas-runtime", "Runtime class and lifecycle"],
  ["CanvasSurface", "/docs/explanation/canvas-surface", "Surface facade returned by registerSurface"],
  ["registerSurface()", "/docs/explanation/register-surface", "Register an HTML element as a surface"],
  ["paintOnce()", "/docs/explanation/paint-once", "Wait for one Prism-owned paint pass"],
  ["Invalidation", "/docs/explanation/invalidation", "Schedule another runtime paint pass"],
  ["Cleanup", "/docs/explanation/cleanup", "Dispose surfaces and destroy the runtime"],
  ["Export a PNG", "/docs/how-to/export-png", "Use paintOnce then canvas.toBlob"],
  ["Convert coordinates", "/docs/how-to/coordinate-conversion", "CSS pixels and backing-store pixels"],
  ["Sync transforms", "/docs/how-to/sync-transforms", "Keep app transforms aligned with surface bounds"],
  ["Prism Atlantic", "/docs/examples/prism-atlantic", "NOAA/NHC storm-track data visualization"],
  ["React Composer Lite", "/docs/examples/react-composer-lite", "React components as Prism surfaces"],
  ["Pie Chart", "/docs/examples/pie-chart", "Minimal WICG-derived canvas/data example"],
  ["API", "/docs/reference/api", "Public package-root API"],
  ["Types", "/docs/reference/types", "Public TypeScript types"]
] as const;

export function PrismTopNav() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("prism-docs-theme");
    const nextTheme = saved === "light" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("prism-docs-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [searchOpen]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return searchItems;
    }

    return searchItems.filter(([title, , description]) =>
      `${title} ${description}`.toLowerCase().includes(normalized)
    );
  }, [query]);

  return (
    <header className="prism-top-nav">
      <div className="prism-top-nav-inner">
        <Link className="prism-brand" href="/">
          Prism
          <code>v0.4</code>
        </Link>

        <nav className="prism-nav-links" aria-label="Primary navigation">
          <Link className="active" href="/docs/tutorials/introduction">
            Docs
          </Link>
          <Link href="/docs/reference/api">API</Link>
          <Link href="/docs/examples/prism-atlantic">Examples</Link>
          <a href="https://github.com/synthesiseng/prism/releases">Changelog</a>
        </nav>

        <div className="prism-nav-spacer" />

        <button
          className="prism-search-preview"
          type="button"
          aria-label="Search docs"
          onClick={() => setSearchOpen(true)}
        >
          <span aria-hidden="true">⌕</span>
          <span>Search docs...</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          className="prism-theme-preview"
          type="button"
          aria-label="Toggle theme"
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        >
          <span aria-hidden="true">◐</span>
          {theme === "dark" ? "dark" : "light"}
        </button>
      </div>

      {searchOpen ? (
        <div
          className="prism-search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search docs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSearchOpen(false);
            }
          }}
        >
          <div className="prism-search-dialog">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search docs..."
              aria-label="Search docs"
            />
            <div className="prism-search-results">
              {results.length > 0 ? (
                results.map(([title, href, description]) => (
                  <Link key={href} href={href} onClick={() => setSearchOpen(false)}>
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </Link>
                ))
              ) : (
                <p>No results.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
