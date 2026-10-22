# Changelog

## Unreleased

### Changed

- Native surface bounds set source layout width and height before the browser snapshot. A size change discovered during paint defers drawing and `paintOnce()` settlement until a fresh snapshot; paint handlers may run again.
- Stable native surfaces retain their interaction state across paints, avoiding repaint feedback when handlers measure layout. Undrawn surfaces are deactivated at the end of the pass, including failure cleanup.
- **Breaking:** registering an element that already belongs to an active surface throws, including duplicate registration within the same runtime. Dispose or unregister the existing surface before registering it again.

### Deferred — open findings

- A caught native draw failure followed by a normally returning paint handler can leave diagnostics healthy and clear `lastError`. The health-reporting correction remains deferred.
- `invalidate()` can arm a native paint deadline without a waiting `paintOnce()` caller; an undelivered paint can report a timeout. The diagnostic policy correction remains deferred.

These are draft unreleased notes. The layout candidate still requires PR review and hosted native qualification; alpha.9 is on hold.
