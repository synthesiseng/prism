# Changelog

## Unreleased

### Changed

- The native adapter uses canvas `content="drawable"`, surface `drawable`, `requestPaint()` and the browser paint lifecycle. Chrome owns native geometry synchronization; Prism preserves application CSS transforms and does not compensate for browser hit-testing failures with transforms or pointer-coordinate corrections. Forced native mode rejects legacy or partial API shapes; users needing the earlier native path can pin alpha.8.
- Native surface bounds set source layout width and height as well as the drawing rectangle; they are not merely a destination for scaling unchanged source layout. Sizing happens before the browser snapshot. A size change discovered during paint defers drawing and `paintOnce()` settlement until a fresh snapshot. Paint handlers may run again, and drawing already performed in an incomplete pass is not rolled back. Retries retain the original visible-time deadline budget.
- Stable native surfaces retain their interaction state across paints, avoiding repaint feedback when handlers measure layout. Omitted surfaces are deactivated at the end of the pass, including failure cleanup. Layout-deferred surfaces retain their prior interaction state until the retry completes or fails.
- **Breaking:** registering an element that already belongs to an active surface throws, including duplicate registration within the same runtime, which previously returned the existing surface. Ownership is exclusive across runtimes sharing the same loaded module instance; a canvas also has at most one live runtime. Dispose or unregister the existing surface before registering it again.
- Cleanup restores an initial attribute or style value only while the current value still matches Prism's last write. This includes layout width/height and every `pointer-events`/`inert` toggle. Application changes to different values survive cleanup; an application write equal to Prism's value cannot be distinguished. Ownership and remaining cleanup resources are released even when an individual cleanup operation throws.
- Native paint deadlines count elapsed visible time. Hidden periods pause the remaining budget without resetting it, and a paint delivered while hidden can still settle. The configurable default is 2000 ms, supported by measured workloads rather than a browser scheduling guarantee. Settlement and destruction release timers and visibility listeners; late events do not revive rejected requests.
- `stop()` stops animation without cancelling explicit `paintOnce()` requests. Concurrent callers coalesce into a pending pass; callers added during painting belong to a later pass. `destroy()` rejects outstanding requests and releases runtime resources.
- Application paint-handler errors reject waiting callers with the original thrown value, or reach `reportError()` when there are no waiting callers. Application errors are not relabeled as native platform failures. Native draw failures preserve their original cause; capability reports API presence, separately from runtime health and actual rendering qualification.

### Fixed

- Fallback bounds changes made inside `onPaint()` now retain repaint work for the next runtime frame. Multiple updates coalesce to the latest bounds without recursive painting or extra idle paints. A stopped runtime still needs `start()` or an explicit paint to consume pending fallback work.
- Packed declarations use resolvable relative imports with explicit extensions. Actual tarball consumers pass strict TypeScript NodeNext, Node16 and Bundler resolution, plus Node ESM import. The package remains ESM with Node >=22; the Node16 resolution test does not claim Node 16 runtime support.
- Native request failures remain authoritative when application callbacks catch them and throw another value. DOM placement restoration is attempted even if tracked-property restoration fails, preserving the first cleanup error if both fail.

### Deferred — open findings

- `invalidate()` can arm a native paint deadline without a waiting `paintOnce()` caller. If the browser does not deliver that paint, diagnostics can report `failed` / `paint-timeout` even though no explicit one-shot paint is awaiting completion. This can be misleading for hidden elements or detached canvases; the diagnostic policy correction remains deferred.
- When an application catches a native draw failure inside its paint handler and then returns normally, the pass can resolve waiting `paintOnce()` callers, report `healthy` and clear `lastError` despite the failed draw. Do not treat those diagnostics or settlement as proof that every caught drawing operation succeeded. The health-reporting correction remains deferred.

### Qualification and release status

- Merged main `da279a2a17b2931a945ea3a78eec57f526ff90dc` passed [ordinary CI](https://github.com/synthesiseng/prism/actions/runs/40004323028) and [native qualification](https://github.com/synthesiseng/prism/actions/runs/40004322923): 146 unit tests, 5 fallback browser tests, packed consumers, 10 native lifecycle/layout tests and 10 raw-platform/Prism geometry, pixel and click scenarios. Native evidence covers Chrome for Testing 158.0.8115.0 on macOS ARM64 with `CanvasDrawElement` enabled and Chromium sandboxing enabled, including DPR 2, CSS scaling, transforms and relocation.
- This is a bounded experimental configuration, not general browser support. Linux native qualification is not established; earlier Chrome for Testing 156 hit-testing failures remain disqualifying for that configuration. The fallback renders placeholders, not HTML snapshots. Image/export fidelity and drawable isolation remain use-case limitations.
- These are draft unreleased alpha.9 notes. Package version remains `0.1.0-alpha.8`; no alpha.9 release has been published by this work. Final release-risk disposition, approval of versioning and qualification of the versioned package remain separate steps.
