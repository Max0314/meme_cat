# Task 003 · Desktop homepage and download

## Goal

Publish the Chinese Cat Meme Studio homepage and Windows x64 portable download at `https://cat.fribench.cn/`.

## Context

- The domain is assigned by the owner and resolves to Fribench's existing host.
- Fribench policy was fetched and read on 2026-11-18 at `9b16161`. The ops catalog owns service registration, edge configuration and the release record.
- The release includes the Task 002 editor changes plus the public page. The desktop package version changes from `0.1.0` to `0.2.0`.

## Constraints

- Use an isolated source worktree. Preserve the original editor checkout and its user data.
- Publish only the portable build and its checksum/manifest. The full offline configuration would include local media and is outside this release.
- Serve the site on a dedicated loopback service. No account, backend database, user uploads or public service port is required.
- Run local verification without opening desktop application or browser windows. The illustration is an editor schematic.

## Plan

1. Verify the editor, build the portable package and stage its SHA-256 metadata.
2. Register the web service and its network in ops. Fetch pinned source and ops commits on the server.
3. Deploy under the platform release lock, issue the subdomain certificate and enable only its Nginx entry.
4. Verify health, redirects, the landing page, asset links, the full downloaded package hash and non-target runtime state.

## Done When

- HTTPS serves the homepage and a valid Windows x64 portable release.
- The published package matches the recorded size and SHA-256 and supports download resumption.
- Ops receipts identify the tested Git revision and the target survives both loopback and public checks.

## Verification

Run `npm.cmd run verify`, `npm.cmd run build:portable`, and `node scripts/stage-desktop-download.mjs` on the clean release checkout. Inspect the packaged file list and linked public files. On the server run the ops validators and registered checks. Record actual window testing separately.

## Rollback Notes

Use the ops runbook to restore a previous release SHA or withdraw the initial site. Preserve versioned artifacts and desktop user files.
