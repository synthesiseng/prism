import Link from "next/link";

const links = [
  {
    href: "/docs/tutorials/first-surface",
    title: "Tutorial",
    body: "Create one HTML surface and draw it through CanvasRuntime."
  },
  {
    href: "/docs/explanation/concepts",
    title: "Concepts",
    body: "Understand what Prism owns and what your app still owns."
  },
  {
    href: "/docs/reference/api",
    title: "API Reference",
    body: "See the supported public package-root API."
  }
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-16">
      <section className="space-y-4">
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-fd-muted-foreground">
          Prism
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Runtime infrastructure for managed HTML/CSS canvas surfaces.
        </h1>
        <p className="max-w-2xl text-lg text-fd-muted-foreground">
          Prism builds on the HTML-in-Canvas proposal. It owns surface
          registration, paint lifecycle, sizing, invalidation, readiness, and
          cleanup so apps can keep their own rendering and UI decisions.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            className="rounded-lg border bg-fd-card p-5 transition-colors hover:bg-fd-accent/60"
            href={link.href}
          >
            <h2 className="font-medium">{link.title}</h2>
            <p className="mt-2 text-sm text-fd-muted-foreground">{link.body}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
