# Prism Pie Chart Example

This example adapts the pie-chart code from the HTML-in-Canvas explainer to
Prism's runtime model.

The app draws chart wedges with the canvas 2D API and registers the labels as
Prism-managed HTML surfaces. App code does not call `layoutsubtree`, `onpaint`,
`requestPaint()`, or `drawElementImage()` directly.

```sh
pnpm --filter @prism/example-pie-chart dev
```

For the original example go to: [HTML-in-Canvas proposal](https://github.com/WICG/html-in-canvas)
