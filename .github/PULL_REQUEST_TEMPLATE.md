## Summary

<!-- What changed and why? -->

## Checklist

- [ ] I ran `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [ ] Public API changes preserve the Prism doctrine in `AGENTS.md`
- [ ] Examples and docs use top-level `@prism/html-canvas` exports
- [ ] No code outside `packages/html-canvas` imports private `runtime/*` modules
- [ ] Fallback behavior remains compatibility-only and does not define the API
