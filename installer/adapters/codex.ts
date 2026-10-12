// OpenAI Codex adapter (CLI, IDE extension, desktop app).
// Paths: user ~/.agents/skills, repo .agents/skills (from the working directory up to the repo root).
// $CODEX_HOME/skills (default ~/.codex/skills) is deprecated but still loaded, so a copy there
// shows up as a duplicate. Optional UI metadata lives in agents/openai.yaml (ignored by other
// platforms). Sources: https://learn.chatgpt.com/docs/build-skills and openai/codex
// codex-rs/ext/skills/src/host_roots.rs (checked 2026-10-12).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exists, isDir, which } from '../lib/context.ts'
import type { Adapter, CheckResult, Context, Scope } from '../lib/types.ts'

function codexHome(ctx: Context): string {
  return ctx.env.CODEX_HOME ? ctx.env.CODEX_HOME : join(ctx.home, '.codex')
}

export const codex: Adapter = {
  id: 'codex',
  displayName: 'OpenAI Codex',
  docs: ['https://learn.chatgpt.com/docs/build-skills', 'https://github.com/openai/codex'],
  limitations: [
    'Detection looks for the codex command and ~/.codex ($CODEX_HOME); the desktop app alone may not be detected (select it manually).',
    'Loading is not verified by the installer; type /skills in Codex to confirm.',
  ],
  installRoot(scope: Scope, ctx: Context): string {
    return scope === 'user' ? join(ctx.home, '.agents', 'skills') : join(ctx.projectDir, '.agents', 'skills')
  },
  scanRoots(scope: Scope, ctx: Context): string[] {
    if (scope === 'project') return [join(ctx.projectDir, '.agents', 'skills'), join(ctx.projectDir, '.codex', 'skills')]
    const roots = [join(ctx.home, '.agents', 'skills'), join(codexHome(ctx), 'skills')]
    if (ctx.platform !== 'win32') roots.push('/etc/codex/skills')
    return roots
  },
  detect(ctx: Context) {
    const evidence: string[] = []
    if (which('codex', ctx)) evidence.push('codex on PATH')
    if (isDir(codexHome(ctx))) evidence.push(ctx.env.CODEX_HOME ? '$CODEX_HOME exists' : '~/.codex exists')
    return { present: evidence.length > 0, evidence }
  },
  activation(): string {
    return 'Picked up automatically on the next turn; restart Codex if it does not appear in /skills.'
  },
  invocation: '$rack-cabling-designer or /skills, or describe a rack/cabling task',
  specificFiles: ['agents/openai.yaml'],
  check(skillDir: string, ctx: Context): CheckResult[] {
    const results: CheckResult[] = []
    try {
      const yaml = readFileSync(join(skillDir, 'agents', 'openai.yaml'), 'utf8')
      const ok = /^interface:\s*$/m.test(yaml) && /^\s+display_name:\s*\S/m.test(yaml)
      results.push({ name: 'Codex agents/openai.yaml', status: ok ? 'pass' : 'warn', detail: ok ? 'interface.display_name present' : 'missing interface.display_name (Codex falls back to the skill name)' })
    } catch {
      results.push({ name: 'Codex agents/openai.yaml', status: 'warn', detail: 'not present; Codex uses SKILL.md only' })
    }
    const legacy = join(codexHome(ctx), 'skills', 'rack-cabling-designer')
    if (exists(legacy) && legacy !== skillDir) {
      results.push({ name: 'Codex legacy location', status: 'warn', detail: `another copy exists in the deprecated ${legacy}; Codex lists both. Remove it after checking it is not needed.` })
    }
    return results
  },
}
