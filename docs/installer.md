# Installer

`node installer/install.ts` installs the skill for Claude Code, OpenAI Codex, Cursor or any other Agent Skills-compatible app. It needs Node.js 22.18+ and **nothing else**: no packages, no network, no shell, no administrator rights.

## Interactive flow

```
Step 1 · Assistants      detected ones are pre-selected; undetected ones can be chosen after their
                         limitations are shown; "Other compatible app" asks for its skills folder
Step 2 · Scope           user (every project) or project (one repository)
Step 3 · Plan            destination per assistant, action (install / update / up to date / BLOCKED),
                         and which assistant will see which copies (duplicate warnings)
Step 4 · Authorization   only when a destination holds files this installer did not write, or that
                         changed: "Back it up and replace it? [y/N]" per destination; declined ones
                         are skipped and nothing is written there
Step 5 · Review          [f] list every file  [o] show the exact operations  [y] install  [n] cancel
Step 6 · Result          per destination: verification checks, backup location, next steps, log file
```

End of input or any answer other than yes means **no**.

## Commands

| Goal | Command |
|---|---|
| Interactive install | `node installer/install.ts` |
| Non-interactive install | `node installer/install.ts --agents claude-code,codex --scope user --yes` |
| Other compatible app | `node installer/install.ts --target ~/.myapp/skills --yes` |
| Simulation | `... --dry-run [--show-files]` prints the plan, every operation and file, and writes nothing (no state, no log) |
| Update existing installs only | `node installer/install.ts --update --yes` |
| Verify | `node installer/install.ts --verify [--agents …]` |
| Detection and current state | `node installer/install.ts --list` |
| Uninstall | `node installer/install.ts --uninstall --agents codex --yes` |
| Machine-readable | add `--json` |

Exit codes: `0` ok · `1` blocked, failed, cancelled or partially skipped · `2` usage error.

## Modules

| Concern | Module | Writes? |
|---|---|---|
| Platform conventions (paths, scan roots, detection, limitations, checks) | `adapters/*.ts` | no |
| Detection: assistants present, existing copies and who sees them | `lib/detect.ts` | no |
| Plan: destinations, sharing, actions, operations, visibility | `lib/plan.ts` | no |
| Execution: staging, backup, placement, rollback | `lib/execute.ts` | yes |
| Uninstall (receipt-driven) | `lib/uninstall.ts` | yes |
| Verification: format, integrity, Node, self-test, platform checks | `lib/verify.ts` | no |
| Operation log (JSON lines) | `lib/log.ts` | yes (state folder) |
| Error messages | `lib/errors.ts` | no |
| Interface | `lib/prompt.ts`, `lib/report.ts`, `install.ts` | no |

## Safety guarantees (each one is covered by a test)

| Requirement | How |
|---|---|
| Never overwrite files of others without authorization | Foreign copies, links, locally modified copies and newer versions are **BLOCKED**. They are only replaced after an explicit per-destination "yes" or `--force`, and are always backed up first to `~/.rack-cabling-designer/backups/` (outside every skills folder; last 3 kept). |
| No arbitrary commands | No shell is ever used. The only process started is `node <installed>/scripts/rackcab.ts selftest`, with the current Node binary and fixed arguments. It runs only when the copy's files match this installer's receipt, or the copy is a link to this checkout. Foreign or modified copies are inspected read-only. |
| No remote code | The installer has no network code at all. It installs from the checkout you already have, after checking it against `MANIFEST.json` (SHA-256). |
| No administrator rights | Destinations are inside your home or project. Custom folders outside them are refused. Windows dev links use directory junctions, which need no elevation. Permission errors suggest a folder you own, never sudo or admin, and running as root prints a warning. |
| Never delete user projects | Uninstall removes only the files listed in the receipt. It never removes the skills folder, the project or files you added, never follows links, and refuses to delete copies it did not install. |
| Simulation | `--dry-run` uses the same planning code as a real run and writes nothing. |
| Error handling | Each destination is atomic: on any failure it is rolled back and its backup restored. Filesystem errors are translated (permission, file in use, disk full, file instead of folder, path too long). |
| Logging | Every real run writes `~/.rack-cabling-designer/logs/<time>-<mode>.jsonl` (last 20 kept). |

## Platforms that cannot be detected or verified

Each adapter lists its limitations, and `--list` and the menu show them. For example, the Cursor version cannot be read from disk, and whether any app actually *loads* the skill cannot be checked from outside the app. You can still select an undetected assistant manually: the installer explains what it cannot check, installs only files, verifies files, format and the self-test, and tells you how to confirm in the app.

For an app the installer does not know, use "Other compatible app" (`--target <its skills folder>`).

## Adding a platform

1. Create `adapters/<platform>.ts` with paths, scan roots, detection, limitations, activation, invocation and read-only checks. Cite the official docs and the date.
2. Register it in `adapters/index.ts`.
3. Add adapter tests and a row in [compatibility.md](compatibility.md).

Detection, planning, execution and verification need no changes.

## Why no dependencies

A prompt library or a TUI framework would add supply-chain surface to a tool whose job is to write into folders that AI agents trust. `node:readline` is enough for numbered menus and yes/no prompts, and also works with piped input, which is what the interactive tests use.
