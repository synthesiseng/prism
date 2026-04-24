# Prism Pie Chart Example

This example adapts the pie-chart idea from the HTML-in-Canvas explainer to
Prism's runtime model.

The app draws chart wedges with the canvas 2D API and registers the labels as
Prism-managed HTML surfaces. App code does not call `layoutsubtree`, `onpaint`,
`requestPaint()`, or `drawElementImage()` directly.

```sh
pnpm --filter @prism/example-pie-chart dev
```
