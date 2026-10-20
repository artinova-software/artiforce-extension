# ADR-005 — Generate a static host list from the supplier registry

## Status

Accepted.

## Date

2026-10-19

## Decision

`libs/suppliers/src/registry/suppliers.json` is the single list of supplier
sites. The build generates the manifest's `content_scripts.matches` (active
suppliers) and `host_permissions` (every listed supplier, disabled ones
included, plus their image hosts) from it. Hosts are exact, https only, with no
wildcard. The first public release ships the complete list (about 140 sites).

## Rationale

- Static declarations are what store reviewers can read and what users accept
  once at install.
- Adding a host after publication is a new permission: Chrome disables the
  extension for every user until they accept it. Keeping disabled suppliers in
  `host_permissions` means re-enabling one is free.

## Consequences

- About 140 hosts trigger an in-depth store review: the listing explains the
  single purpose and each permission ([store-listing.md](../store-listing.md)).
- Suppliers added after the first public release go through
  `optional_host_permissions` and `scripting.registerContentScripts`, asked at
  use time, not through this list.
- A host change shows up in the manifest snapshot test and must be discussed
  in the pull request.
