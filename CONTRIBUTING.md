# Contributing

Prism is a native-first HTML-in-Canvas runtime. Keep changes aligned with
`AGENTS.md`; it is the project doctrine.

## Branches and Pull Requests

- Work on a focused branch.
- Keep commits clean and scoped to one concern.
- Explain public API changes clearly in the pull request.
- Do not mix runtime behavior changes with unrelated formatting or cleanup.

## Checks

Run the full verification set before opening a pull request:

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm e2e && pnpm --filter @prism/docs build && pnpm build && npm pack --json
```

## Runtime Direction

- `@synthesisengineering/prism` is the public Prism v1 package entry point.
- Preserve the native-first HTML-in-Canvas model.
- Fallback is compatibility-only and must not shape the public API.
- Public API names should stay plain, boring, and obvious.
- Public surface bounds and input coordinates use CSS pixels.
- Do not expose raw `onpaint`, `requestPaint()`, `drawElementImage()`, or
  `layoutsubtree` through app-facing examples or APIs.

## Internal Boundaries

- Do not import `packages/html-canvas/src/runtime/*` from outside
  `packages/html-canvas`.
- Do not document `runtime/*` modules as public API.
- Use the package-root `@synthesisengineering/prism` exports in examples and external code.

## Documentation

- Public exported APIs should have useful TSDoc.
- Keep docs factual and concise.
- Do not add demos, wrappers, or docs infrastructure unless they directly serve
  the current runtime direction.

## Release checklist

- Update package versions and the README install command together, then run `pnpm test:package` against the actual archive.
- Check the README, changelog, migration guide, API and types reference, and the installation, introduction and explanation pages for candidate labels and version references. The packed README must describe its exact version without release-pending wording. Keep website candidate wording before publication; remove it only when that version is released.
- Verify registry availability before updating website installation commands, the home page and top-navigation version label. Do not imply an unreleased package is installable or change npm dist-tags without approval.
- Require passing ordinary and native qualification on the release source, including the packed Atlantic consumer and Node 22 checks.
