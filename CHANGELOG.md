# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

### Added

- **Website and docs** at https://whetstone-dev.github.io/rack-cabling-designer/ (`web/`, published by the Pages workflow): interactive rack built from the bundled examples, 13 docs pages and a library of 27 prompts. The build serves the real example outputs and the JSON Schema at the URL its `$id` declares.

- **Installer interface:** numbered interactive steps (assistants, scope, plan, authorization, review, result).
- **Selection:**
  - Manual selection of undetected assistants, after showing what cannot be detected or verified.
  - "Other compatible app" via `--target <skills folder>`, kept inside the home or project folder.
- **Review and simulation:** `--show-files` and the review menu list every file; `--dry-run` prints the exact operations.
- **Modes and logging:** `--update` mode, and a JSON-lines operation log of every real run.
- **Authorization:** each destination holding foreign or changed files needs its own approval; declined ones are skipped.

### Changed

- OpenAI Codex and Cursor are now declared **compatible**: activation was confirmed manually in the real apps (see the audit addendum).
- The installer is split into detection (`detect.ts`), planning (`plan.ts`), execution (`execute.ts`, `uninstall.ts`) and verification (`verify.ts`).
- Filesystem errors are explained (permission, busy, disk full, file instead of folder).

### Fixed

- **D1, D2:** `--project` with a non-existent path or a file no longer creates folders or fails late.
- **D3:** a custom `--target` whose parent folder is missing (typo) is refused.
- **D4:** Ctrl+C during installation finishes or rolls back the current destination, then stops.
- **D5:** stale staging folders from aborted runs are cleaned.

### Added (audit)

- `tools/audit.ts`: structural and local functional audit per platform and scope.
- Smoke test with control, discovery, implicit and explicit cases, event-stream evidence and an INCONCLUSIVE status for environment errors.
- Scenario tests: missing paths, permissions (simulated and POSIX), cancellation, stale staging.

### Security

- The self-test is no longer run on copies that are not verified as installed by this installer (`--verify` used to execute any copy it found).
- A destination whose skills folder is a file is blocked during planning.

## [0.1.0] - 2026-10-12

### Added

- **Skill core:**
  - Portable skill core: `SKILL.md` (Agent Skills spec fields only), 9 references, site-survey and change-plan templates, and 3 examples.
  - `rackcab` toolkit (Node ≥ 22.18, zero dependencies) with these commands: `validate`, `build`, `elevation`, `schedule`, `labels`, `bom`, `power`, `trace`, `init`, `catalog` and `selftest`.
- **Rules:** 38 `RCD-*` rules across schema/identity, rack fit, airflow, power (derating, A/B failover, connectors) and cabling (ports, media fit, speed, reach, the copper channel model, parallel optics) and labels.
- **Data model:** `modelVersion 1` JSON Schema, data files with sources (`media.json`, `power.json`) and a generic equipment catalog.
- **Installer:**
  - Installer for Claude Code, OpenAI Codex and Cursor. It offers user or project scope, shares compatible folders and shows a visibility map with duplicate warnings.
  - Installs are staged and atomic, with backup and rollback.
  - Verification checks hashes, format, Node version, self-test and platform-specific rules.
  - Uninstall is driven by the install receipt, and a dev link mode is available.
- **Testing:** 44 automated tests, a skill linter, a manifest check, and a platform smoke test script.

[Unreleased]: https://github.com/whetstone-dev/rack-cabling-designer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/whetstone-dev/rack-cabling-designer/releases/tag/v0.1.0
