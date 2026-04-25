"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  {
    title: "Getting Started",
    items: [
      ["Introduction", "/docs/tutorials/introduction"],
      ["Quickstart", "/docs/tutorials/quickstart"],
      ["Installation", "/docs/tutorials/installation"],
      ["Mental Model", "/docs/tutorials/mental-model"]
    ]
  },
  {
    title: "Runtime",
    items: [
      ["CanvasRuntime", "/docs/explanation/canvas-runtime"],
      ["CanvasSurface", "/docs/explanation/canvas-surface"],
      ["registerSurface()", "/docs/explanation/register-surface"],
      ["paintOnce()", "/docs/explanation/paint-once"],
      ["Invalidation", "/docs/explanation/invalidation"],
      ["Cleanup", "/docs/explanation/cleanup"]
    ]
  },
  {
    title: "Guides",
    items: [
      ["Export a PNG", "/docs/how-to/export-png"],
      ["Convert coordinates", "/docs/how-to/coordinate-conversion"],
      ["Sync transforms", "/docs/how-to/sync-transforms"]
    ]
  },
  {
    title: "Examples",
    items: [
      ["Prism Atlantic", "/docs/examples/prism-atlantic"],
      ["React Composer Lite", "/docs/examples/react-composer-lite"],
      ["Pie Chart", "/docs/examples/pie-chart"]
    ]
  },
  {
    title: "Reference",
    items: [
      ["API", "/docs/reference/api"],
      ["Types", "/docs/reference/types"]
    ]
  }
] as const;

export function PrismDocsSidebar() {
  const pathname = usePathname();
  const activePath = pathname === "/" || pathname === "/docs" ? "/docs/tutorials/introduction" : pathname;

  return (
    <aside className="prism-home-sidebar" aria-label="Docs navigation">
      {sections.map((section) => (
        <div key={section.title} className="prism-home-sidebar-section">
          <h2>{section.title}</h2>
          {section.items.map(([label, href]) => (
            <Link key={href} className={activePath === href ? "active" : ""} href={href}>
              {label}
            </Link>
          ))}
        </div>
      ))}
    </aside>
  );
}
