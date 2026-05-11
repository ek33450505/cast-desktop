## What Does This PR Do?

<!-- A clear description of the changes. Link the issue(s) it addresses if applicable. -->

## Why?

<!-- The motivation. Why does Cast Desktop need this? What problem does it solve or capability does it add? -->

## Type of Change

- [ ] New dashboard or view
- [ ] API route or backend enhancement
- [ ] Terminal integration
- [ ] Bug fix
- [ ] Docs or README
- [ ] Tests
- [ ] Build or CI
- [ ] Refactor

## How Was This Tested?

<!-- Let us know how you verified the changes work:
- Manual testing: "Ran `npm run dev` and tested X feature..."
- Unit tests: "Added Vitest tests in..."
- API testing: "Used curl to test /api/... endpoint..."
-->

## Linked Issues

Closes #<!-- issue number --> or Refs #<!-- issue number -->

## Pre-Merge Checklist

- [ ] Code works locally with `npm run dev`
- [ ] `npm run test` passes (if tests added or modified)
- [ ] No new console errors or warnings in browser DevTools (F12)
- [ ] If adding a new dashboard page: added to React Router config and tested navigation
- [ ] If adding a new API route: endpoint documented, tested locally with curl or Postman
- [ ] If modifying database queries: tested against a real `~/.claude/cast.db`
- [ ] No hardcoded paths — using `$HOME` or `~/` where needed
- [ ] README updated if user-facing behavior changed
- [ ] Commits follow the pattern: `<type>(<scope>): <description>` (e.g., `feat(dashboard): add token spend chart`)

## Screenshots / Demo

If this adds UI, please share a screenshot or screen recording here. If it's backend-only, you can skip this.

## Questions?

Feel free to ask in the PR thread — we're here to help you succeed with this contribution.
