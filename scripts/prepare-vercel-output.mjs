import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(repoRoot, "dist");

const apps = [
  {
    title: "Prism Atlantic",
    path: "atlantic",
    dist: path.join(repoRoot, "apps/prism-atlantic/dist")
  },
  {
    title: "Prism Atelier",
    path: "atelier",
    dist: path.join(repoRoot, "apps/prism-atelier/dist")
  },
  {
    title: "React Composer Lite",
    path: "composer-lite",
    dist: path.join(repoRoot, "apps/react-composer-lite/dist")
  }
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const app of apps) {
  await cp(app.dist, path.join(outputRoot, app.path), { recursive: true });
}

await writeFile(
  path.join(outputRoot, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Prism Examples</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        background: #09090b;
        color: #fafafa;
        margin: 0;
        min-height: 100vh;
        padding: 48px;
      }

      main {
        max-width: 720px;
      }

      h1 {
        font-size: 32px;
        letter-spacing: 0;
        margin: 0 0 12px;
      }

      p {
        color: #a1a1aa;
        line-height: 1.6;
        margin: 0 0 28px;
      }

      nav {
        display: grid;
        gap: 12px;
      }

      a {
        border: 1px solid #27272a;
        border-radius: 8px;
        color: #fafafa;
        padding: 16px 18px;
        text-decoration: none;
      }

      a:hover {
        border-color: #22d3ee;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Prism Examples</h1>
      <p>Native-first HTML-in-Canvas examples built from the Prism workspace.</p>
      <nav>
${apps.map((app) => `        <a href="/${app.path}/">${app.title}</a>`).join("\n")}
      </nav>
    </main>
  </body>
</html>
`,
  "utf8"
);
