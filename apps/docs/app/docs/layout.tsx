import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";
import { PrismDocsSidebar } from "../prism-docs-sidebar";
import { PrismTopNav } from "../prism-top-nav";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="prism-docs-root">
      <PrismTopNav />
      <div className="prism-home-shell prism-home-grid prism-docs-shell">
        <PrismDocsSidebar />
        <div className="prism-docs-main">
          <DocsLayout
            {...baseOptions()}
            nav={{ enabled: false }}
            sidebar={{ enabled: false }}
            tree={source.pageTree}
          >
            {children}
          </DocsLayout>
        </div>
      </div>
    </div>
  );
}
