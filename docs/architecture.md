# Architecture

```
skills/rack-cabling-designer/      PORTABLE CORE — the only thing installed
├── SKILL.md                       instructions (Agent Skills spec fields only)
├── references/*.md                technical references, loaded on demand
├── scripts/rackcab.ts             CLI: validate, build, elevation, schedule, labels, bom, power, trace, init, selftest
├── scripts/lib/                   model, schema, channels, power, occupancy
│   ├── rules/                     integrity, rack, airflow, power, cabling, labels  (all RCD-* rules)
│   └── outputs/                   elevation (HTML/SVG), schedule, labels, BOM, reports
├── scripts/test/                  core tests
├── assets/schema/                 rack-model JSON Schema (modelVersion 1)
├── assets/data/                   media reach, power defaults (each value with its source)
├── assets/catalog/                generic equipment types
├── assets/templates/              model skeleton, site survey, change plan
├── examples/                      2 healthy models + 1 deliberately broken model
├── agents/openai.yaml             Codex UI metadata (ignored elsewhere)
└── MANIFEST.json                  file list + SHA-256 (generated)

installer/                         INSTALLATION — knows nothing about racks (details: installer.md)
├── install.ts                     CLI and interactive flow
├── adapters/{claude-code,codex,cursor,custom}.ts   paths, scan roots, detection, limitations, checks
└── lib/                           detect · plan · execute · uninstall · verify · log · errors
                                   (+ manifest, receipt, skill-format, prompt, report)

tools/                             build-manifest.ts, lint-skill.ts
tests/                             adapters/, installer/, repo/, platform-smoke/
```

## Principles

- **One core, no per-platform forks.** Every platform installs byte-identical files. The only platform-specific payload file, `agents/openai.yaml`, is inert elsewhere. Rules (`RCD-*`) exist once, in `scripts/lib/rules/`; a repo test fails if rule codes appear in the installer or tools.
- **Adapters are data plus checks.** An adapter answers: where do I install, which folders does this platform scan, is it present, how is a new skill activated, and which platform-specific checks apply. It never transforms the skill.
- **The model is the source of truth.** `*.rack.json` → validation → all outputs. Generated files are never edited by hand.
- **Zero dependencies.** Node ≥ 22.18 runs the TypeScript directly; no build step, no `node_modules`, nothing downloaded at install time.

## Install flow

1. **Detect** assistants (config folders, binaries on PATH) and existing copies (own receipt, `npx skills` lock, links, manual copies).
2. **Plan** without writing: one target per needed folder. A platform that scans a folder already planned for another platform shares it (Codex + Cursor share `~/.agents/skills`). Existing copies decide the action: install, update, unchanged, reinstall, replace (`--force`) or **blocked**.
3. **Show** destinations, actions and the visibility map (which assistant will see which copies), with duplicate warnings. `--dry-run` stops here.
4. **Write** per target: copy manifest files to a staging folder outside every skills root, verify hashes, move any existing copy to `~/.rack-cabling-designer/backups/` (last 3 kept), move staging into place.
5. **Verify** each copy: SKILL.md format, file hashes vs receipt, Node version, `rackcab selftest`, platform checks. On failure the target is rolled back.
6. **Receipt** `.rcd-install.json` records version, scope, assistants and file hashes; uninstall deletes only those files.

## Versioning

- Skill: SemVer in `SKILL.md` `metadata.version`, mirrored in `MANIFEST.json` and `package.json`.
- Model format: `modelVersion` (integer, independent). A breaking change ships a migration note and, when needed, a `migrate` command.
- Data files: `dataVersion` in each `assets/data/*.json`; value changes are at least a minor release and listed in the changelog.
- Updates: get the new release and run the installer again; it detects the installed version (update / unchanged / downgrade blocked) and keeps a backup.
