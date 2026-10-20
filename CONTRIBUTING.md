# Contributing

## Branches and pull requests

- The default branch is `main`. Work on a branch named `feat/…`, `fix/…` or
  `chore/…`, and open a **draft** pull request early.
- CI (`.github/workflows/ci.yml`) must be green: format, lint, typecheck, unit
  tests, the three browser builds, `web-ext lint`, then the Playwright suite.
- There are no git hooks: CI enforces the rules.

## Commits

Conventional commits in English, `type(scope): summary`, for example
`feat(cart): purge expired items on startup` or `fix(suppliers): read BE prices`.
Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `build`.

## Before pushing

```bash
pnpm check
```

```bash
pnpm test:e2e
```

## Adding a supplier

Follow [docs/adding-a-supplier.md](docs/adding-a-supplier.md) (`pnpm supplier:new`).
A new host changes the manifest permissions: read
[ADR-005](docs/adr/ADR-005-static-host-list-from-registry.md) first.

## Text

User-facing text is French (vouvoiement, « », …, no em dash). Code, comments,
commit messages and docs are English.
