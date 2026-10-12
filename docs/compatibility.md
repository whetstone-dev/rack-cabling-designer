# Compatibility and capability matrix

Checked against official documentation and source on **2026-10-12**. Platform conventions change; the installer keeps them in one place per platform (`installer/adapters/*.ts`), and `node installer/install.ts --list` shows what applies on your machine.

Legend: ✅ supported and verified in this repo · ☑️ supported per official docs, not exercised end-to-end here · ⚠️ undocumented or partially supported · ❌ not supported

## Capability matrix

| Capability | Claude Code | OpenAI Codex (CLI, IDE, app) | Cursor 2.4+ (editor, CLI) |
|---|---|---|---|
| **Global (user) install** | ✅ `~/.claude/skills/<name>/` (`$CLAUDE_CONFIG_DIR/skills` if set) | ✅ `~/.agents/skills/<name>/` · `$CODEX_HOME/skills` still read but **deprecated** | ✅ `~/.cursor/skills/<name>/` · also reads `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills` |
| **Project install** | ✅ `.claude/skills/<name>/` (also nested folders) | ✅ `.agents/skills/<name>/` from the working directory up to the repo root · `.codex/skills` read (undocumented) | ✅ `.cursor/skills/` or `.agents/skills/` · also reads `.claude/skills`, `.codex/skills` |
| **Skill format** | Agent Skills `SKILL.md` + many optional Claude-only frontmatter keys (we use none) | Agent Skills `SKILL.md` (parses `name`, `description`; ignores unknown keys) + optional `agents/openai.yaml` (UI metadata, invocation policy) | Agent Skills `SKILL.md`; `name` **must match the folder**; optional `paths`, `disable-model-invocation`, `icon`, `color` |
| **Platform-specific file shipped** | none | `agents/openai.yaml` (ignored elsewhere) | none |
| **Explicit invocation** | `/rack-cabling-designer` | `$rack-cabling-designer`, `/skills` | `/rack-cabling-designer` |
| **Implicit invocation** | ✅ by description | ✅ by description (`policy.allow_implicit_invocation: true`) | ✅ by description |
| **Discovery after install** | Live; `/reload-skills` if the skills root did not exist at session start | Next turn; restart if missing | At startup: restart / reload window ⚠️ (hot reload undocumented) |
| **Script execution** (`node scripts/rackcab.ts`) | ✅ via Bash tool, subject to permission prompts or `allowedTools` | ✅ via shell in sandbox `workspace-write` (default); **network off** by default (not needed) | ☑️ in the agent terminal under the Run Mode (Auto-review / Allowlist / Run Everything); Windows sandbox behaviour undocumented ⚠️ |
| **File access** | Reads the skill folder; writes models/outputs in the project with permission | Reads anywhere; writes only inside the workspace (outputs go to the project); `.agents/` and `.codex/` are read-only *for the agent* | `~/.cursor/skills` is inside the read boundary; `~/.agents/skills` read access under sandbox ⚠️ undocumented |
| **Visualizations** (`elevation.html`, self-contained, no JS) | File output; open in a browser (Claude desktop can preview HTML) | File output; open in a browser | File output; open in a browser or the editor's preview |
| **Node.js requirement for validators** | Node ≥ 22.18 on PATH | Node ≥ 22.18 on PATH | Node ≥ 22.18 on PATH |
| **Without Node** | Instructions + references only (validators reported as not executed) | same | same |
| **Installer target** | ✅ | ✅ | ✅ |
| **Structural audit** (`tools/audit.ts`) | ✅ user + project | ✅ user + project | ✅ user + project |
| **Functional, local** (toolkit run from the installed copy) | ✅ | ✅ | ✅ |
| **Functional, real assistant (headless)** | ✅ 4/4: control, discovery, implicit (`Skill` tool call), explicit `/` | ⚠️ 2/4 PASS (control, discovery). Implicit: skill selected, but the Windows sandbox failed to spawn. Explicit: account usage limit. Both INCONCLUSIVE | ⛔ not run (no CLI) |
| **Manual, in the app UI** | ✅ desktop app (Code tab) · ⏳ IDE extension | ✅ discovery, implicit and explicit activation (maintainer, 2026-10-12) | ✅ discovery, implicit and explicit activation (maintainer, 2026-10-12) |
| **Declared status** | **Compatible (CLI + desktop app)** | **Compatible** (verified manually in the real app) | **Compatible** (verified manually in the real editor) |

Evidence and open items: [audit/2026-10-12-audit.md](audit/2026-10-12-audit.md).

### Other surfaces (not targeted by the installer yet)

| Surface | Status | Notes |
|---|---|---|
| claude.ai / Claude API (zip upload) | ⚠️ phase 2 | Format already compatible: frontmatter uses only the 6 spec fields and the name avoids "claude"/"anthropic". Container has no network; Node ≥ 22.18 availability not verified, so validators may not run. |
| Claude Code plugin / marketplace | ⚠️ phase 2 | Repo layout (`skills/<name>/`) already matches the plugin layout; needs `.claude-plugin/plugin.json`. |
| Other Agent Skills clients (Copilot, Gemini CLI, OpenCode, …) | ☑️ installer `--target <skills folder>` ("Other compatible app") | Not detectable and not load-verifiable. Files, format and self-test are verified. `npx skills add whetstone-dev/rack-cabling-designer` also works. |
| Cursor < 2.4 | ❌ | Fallback (a `.cursor/rules/*.mdc` pointer rule) planned for phase 2. |

## Shared vs specific

| Layer | Shared by all platforms | Platform-specific |
|---|---|---|
| Instructions | `SKILL.md` (spec fields only) | — |
| References, templates, examples | `references/`, `assets/templates/`, `examples/` | — |
| Validators and rules | `scripts/` (one implementation, `RCD-*` rules) | — |
| UI metadata | — | `agents/openai.yaml` (Codex) |
| Install location, discovery, activation | — | `installer/adapters/<platform>.ts` (data + checks only) |

## Known limitations

1. **Duplicates.** Cursor reads the Claude Code and Codex folders. Installing for Claude Code *and* Codex/Cursor leaves two copies visible to Cursor; precedence between duplicate names is undocumented. The installer shares compatible folders, shows the visibility map before writing and warns. Keep both copies on the same version.
2. **Codex legacy folder.** Copies in `~/.codex/skills` are still loaded and appear twice; `--verify` warns about them. The installer never writes there.
3. **Codex environment on the audit machine:**
   - The default model `gpt-5.6-sol` is rejected for ChatGPT accounts; use `--model gpt-5.5`.
   - The Windows sandbox once failed to spawn processes (`CreateProcessAsUserW … 1312`).
   - The account then hit its usage limit.

   None of these is a skill defect. They blocked the automated headless run only; activation was then confirmed manually in the real app (2026-10-12).
4. **Cursor version** cannot be read from disk; skills need 2.4+.
5. **Agent-driven installs.** Codex's sandbox protects `.agents/`, so asking Codex itself to run the installer into `.agents/skills` needs approval. Running the installer yourself in a terminal is unaffected.
6. **Windows links.** `--link` uses directory junctions (no admin rights needed). Copies are the default.
7. **Visualizations** are files, not inline renders, on all three platforms.
