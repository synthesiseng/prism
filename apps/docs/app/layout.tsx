import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Prism Docs",
    template: "%s | Prism"
  },
  description:
    "Documentation for Prism, a native-first HTML-in-Canvas runtime for managed HTML/CSS canvas surfaces.",
  authors: [{ name: "Sara Loera" }, { name: "Synthesis Engineering" }],
  creator: "Sara Loera",
  publisher: "Synthesis Engineering",
  keywords: [
    "Prism",
    "Synthesis Engineering",
    "Sara Loera",
    "HTML-in-Canvas",
    "CanvasRuntime",
    "HTML canvas",
    "TypeScript runtime"
  ]
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ enabled: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
