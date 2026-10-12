# Contributing

1. Node.js ≥ 22.18. No `npm install` is needed.
2. Edit the skill under `skills/rack-cabling-designer/`. Rules belong in `scripts/lib/rules/` only. Put normative numbers in `assets/data/*.json` with a `source`, and bump that file's `dataVersion`.
3. Platform differences belong in `installer/adapters/<platform>.ts`. When a convention changes, cite the official source and its date in the adapter header and in `docs/compatibility.md`.
4. Run:
   ```bash
   npm run manifest     # after any change inside skills/
   npm test
   npm run lint:skill
   ```
5. Before a release, run the platform smoke tests you can (`node tests/platform-smoke/smoke.ts --agent <id>`) and update `docs/testing.md`.

## Release

- Bump `metadata.version` in `SKILL.md` and `version` in `package.json`.
- Run `npm run manifest`.
- Move `[Unreleased]` in `CHANGELOG.md` to the new version.
- Tag `vX.Y.Z` and publish a release.

Rules for the files themselves:

- Keep `SKILL.md` frontmatter to the six spec fields: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`.
- Write everything public in English. The skill answers users in their own language.
