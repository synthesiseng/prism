# Changelog

## 0.1.0-alpha.10 — Unreleased

### Changed

- **Breaking:** bounds own source layout size, introduced in alpha.9. Natural content must be measured through an inner wrapper rather than the sized surface's `offsetHeight`.
- **Breaking:** bounds now describe the border box. Prism writes `box-sizing: border-box` under the same restore-if-unchanged rule as width and height. Padding and borders fit inside the drawing bounds; application CSS transforms remain application-owned.
- **Breaking:** literal bounds objects are copied at registration and `setBounds()`. In-place mutations no longer update a surface; call `setBounds()` or supply a function provider for changing bounds.
- Four consecutive incomplete native layout passes stop with `LayoutConvergenceError`. Pending callers reject, deferred interaction is cleaned up and self-scheduled retries stop. Native health retains the last platform outcome. Fix layout, then call `setBounds()` or `invalidate()` outside paint to recover; calls inside paint cannot reset the limit. A waiter timeout during layout retry also stops those retries.

### Fixed

- Registration copies `x`, `y`, `width` and `height` explicitly, preserving inherited and accessor-backed bounds such as `DOMRect`.
- Atlantic's live-canvas test sampling keeps PNG capture, decoding and hashing in the browser, avoiding full-image transfers to Node and back. Downloaded PNG assertions, exact pixel comparisons and the 45-second deadline are unchanged.
- Atlantic measures an inner content wrapper, so panels can shrink after their content changes. Its design, controls and data snapshot are unchanged.
- Repeating unchanged literal bounds no longer schedules fallback paints. Effective native position changes after drawing request a following paint without another layout snapshot.
- Package preparation checks the README's pinned install version and rejects release-pending wording. Package-consumer verification checks the actual tarball README too. The intentional `latest` dist-tag policy is unchanged.

### Qualification

- Main `06b377d3bb41ce67e3b75c64b01c84cdfa2cf3e6` passed [ordinary CI](https://github.com/synthesiseng/prism/actions/runs/40966585248) and [native qualification](https://github.com/synthesiseng/prism/actions/runs/40966585136): 166 unit tests, five fallback tests, Node 22 packed consumers, ten geometry/pixel/click scenarios, eleven native lifecycle/layout tests and seven Atlantic cases, with five intentional cross-project skips. Atlantic runs against the packed candidate, including content shrink at DPR 1 and 2. The pinned sandboxed Chrome for Testing 158.0.8115.0 macOS ARM64 configuration passed; this does not establish Linux or broader browser support. CodeRabbit skipped PR #79 while it was a draft; independent local review passed.
- See the [alpha.8 → alpha.10 migration note](https://runprism.dev/docs/how-to/migrate-alpha10). The alpha.10 package is prepared for release. Registry publication and the website installation update are pending.

## 0.1.0-alpha.9 — 2026-10-26

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

- Native diagnostic deadlines are owned by pending `paintOnce()` callers. Waiter-free invalidation can remain pending without a fabricated timeout; joining that outstanding request starts a visible-time budget, and repeated invalidation or concurrent callers do not reset it.
- A native draw failure keeps its paint pass failed even if application code catches the error, draws again successfully, returns normally or throws a different application error. Waiting callers reject with the original native error and diagnostics retain it. A later successful pass restores health; callers requesting that later pass remain separate. Caught native request failures likewise cannot become successful settlement.

- Fallback bounds changes made inside `onPaint()` now retain repaint work for the next runtime frame. Multiple updates coalesce to the latest bounds without recursive painting or extra idle paints. A stopped runtime still needs `start()` or an explicit paint to consume pending fallback work.
- Packed declarations use resolvable relative imports with explicit extensions. Actual tarball consumers pass strict TypeScript NodeNext, Node16 and Bundler resolution, plus Node ESM import. The package remains ESM with Node >=22; the Node16 resolution test does not claim Node 16 runtime support.
- Native request failures remain authoritative when application callbacks catch them and throw another value. DOM placement restoration is attempted even if tracked-property restoration fails, preserving the first cleanup error if both fail.

### Qualification and release status

- Merged main `3297d09d2f3352786e506d35180492f89f887b12` passed [ordinary CI](https://github.com/synthesiseng/prism/actions/runs/40217890346) and [native qualification](https://github.com/synthesiseng/prism/actions/runs/40217890396): 154 unit tests, 5 fallback browser tests, packed consumers, 10 native lifecycle/layout tests and 10 raw-platform/Prism geometry, pixel and click scenarios. Native evidence covers Chrome for Testing 158.0.8115.0 on macOS ARM64 with `CanvasDrawElement` enabled and Chromium sandboxing enabled, including DPR 2, CSS scaling, transforms and relocation.
- This is a bounded experimental configuration, not general browser support. Linux native qualification is not established; earlier Chrome for Testing 156 hit-testing failures remain disqualifying for that configuration. The fallback renders placeholders, not HTML snapshots. Image/export fidelity and drawable isolation remain use-case limitations.
- Versioned main `315bc361fe90a9e97f34084db95c9b7c671cbda4` passed [ordinary CI](https://github.com/synthesiseng/prism/actions/runs/40227357197) and [native qualification](https://github.com/synthesiseng/prism/actions/runs/40227357208), including the alpha.9 packed consumers and default docs build. The [alpha.9 release](https://github.com/synthesiseng/prism/releases/tag/v0.1.0-alpha.9) is published on npm under the `alpha` tag; `latest` remains alpha.1. Independent review passed; CodeRabbit did not complete on PRs #73 and #74, and the owner accepted that review gap before publication.
