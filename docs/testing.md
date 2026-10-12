# Testing

| Level | What | Command | Where |
|---|---|---|---|
| 0 · core | Schema, every rule family, channels, power math, escaping (HTML/Markdown/CSV injection), BOM, CLI exit codes, build gate | `npm run test:core` | CI + local |
| 0 · format | Agent Skills spec (fields, name = folder, lengths, Claude API rules), broken links, manifest freshness | `npm run lint:skill` · `npm run manifest:check` | CI + local |
| 1 · adapters | Paths per platform and scope, env overrides, compatibility roots, detection, platform checks, no domain logic in adapters | `npm run test:installer` | CI + local |
| 1 · installer | Real `install.ts` in a sandboxed home/project/state/PATH. Covers: dry run writes nothing, sharing, idempotency, tamper detection, `--force` with backup, foreign copies untouched, uninstall of shared copies, project scope, dev links, JSON output | `npm run test:installer` | CI + local |
| 1 · detection | Platform status with limitations, existing copies and who sees them | `npm run test:installer` | CI + local |
| 1 · safety | No execution of foreign or tampered code, no network/shell/elevation in the source, bounded custom folders, uninstall keeps projects, clear errors, simulation writes nothing, JSON-lines log, `--update` only touches existing installs | `npm run test:installer` | CI + local |
| 1 · interactive | Menu driven through piped stdin: detected and manual selection, limitations, custom app, file review, per-destination authorization, partial skip, cancel on end of input | `npm run test:installer` | CI + local |
| 2 · platform smoke | Installs in project scope into a temp project and asks the **real** CLI to run the skill on an example | `node tests/platform-smoke/smoke.ts --agent <id> [--model <id>]` | Local, before a release (uses your login) |
| 3 · behaviour | Design prompts graded by objective checks (model validates, outputs exist) | manual, see below | Before a release |

`npm test` runs levels 0 and 1.

## Results on 2026-10-12 (Windows 11, Node 24.13.0)

- Levels 0–1: **68 pass, 1 skipped** (the real `chmod` permission test runs only on POSIX) (`npm test`), `lint-skill` PASS, manifest up to date, `rackcab selftest` PASS.
- Level 2:
  - The smoke test runs 4 cases (control, discovery, implicit, explicit) and takes its evidence from the event stream.
  - Claude Code 2.1.216: **4/4 PASS**.
  - Codex CLI 0.145.0: control and discovery **PASS**. Implicit and explicit were **INCONCLUSIVE**: the Windows sandbox failed to spawn, then the account hit its usage limit.
  - Cursor: **not run**, because no CLI is on PATH.
  - Full matrix and evidence: [audit/2026-10-12-audit.md](audit/2026-10-12-audit.md).
- Structural and local functional audit: `node tools/audit.ts` covers 7 targets (3 platforms × 2 scopes + custom) with 93 checks, all passing. Report: [audit/2026-10-12-structural.md](audit/2026-10-12-structural.md).
- Not run: `skills-ref validate` (the official reference validator). It is installable only from source; `tools/lint-skill.ts` enforces the same rules and CI has an informational job that runs it.
- CI matrix (Ubuntu, Windows, macOS × Node 22, 24) is defined in `.github/workflows/ci.yml`; it runs when the repository is pushed.

## Manual checklist for Cursor (and any platform without a CLI)

1. `node installer/install.ts --agents cursor --scope project --project <tmp> --yes`
2. Copy `skills/rack-cabling-designer/examples/small-office.rack.json` into `<tmp>`.
3. Open `<tmp>` in Cursor 2.4+ and reload the window.
4. Type `/` in Agent chat: `rack-cabling-designer` must be listed.
5. Ask: *"Use the rack-cabling-designer skill: run its rackcab toolkit to validate small-office.rack.json. Reply with only the final summary line."* Expect `PASS: 0 error(s), 0 warning(s)`.
6. Also install for Claude Code at user scope and check whether Cursor lists the skill once or twice; record it in [compatibility.md](compatibility.md).

## Level 3 prompts

1. "Design a 42U rack for 6 1U servers with dual 25G, two leaf switches and A/B 32 A PDUs; give me the elevation and BOM."
2. "Our 24-port panel feeds desks 85 m away and patch cords are 5 m on each side: is that compliant?" (expect RCD-CBL-CHANNEL reasoning)
3. "Validate this model and fix it" on `examples/broken-rack.rack.json` (expect all errors resolved without deleting requirements).
4. "Will PDU A survive if feed B fails?" on the pod example (expect failover math).
5. A Spanish-language request (expect the answer in Spanish, files in English).

Pass when every produced model validates (`--strict` where requested), outputs exist, and answers cite the rule or data source.
