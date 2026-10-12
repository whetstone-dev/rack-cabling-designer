// Claude Code adapter.
// Paths: personal ~/.claude/skills (or $CLAUDE_CONFIG_DIR/skills), project .claude/skills.
// Skills directories are watched live; a skills root created after the session started needs
// /reload-skills (or a restart). Source: https://code.claude.com/docs/en/skills (checked 2026-10-12).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDir, which } from '../lib/context.ts'
import { parseSkill } from '../lib/skill-format.ts'
import type { Adapter, CheckResult, Context, Scope } from '../lib/types.ts'

const LISTING_MAX_CHARS = 1536

function configDir(ctx: Context): string {
  return ctx.env.CLAUDE_CONFIG_DIR ? ctx.env.CLAUDE_CONFIG_DIR : join(ctx.home, '.claude')
}

export const claudeCode: Adapter = {
  id: 'claude-code',
  displayName: 'Claude Code',
  docs: ['https://code.claude.com/docs/en/skills'],
  limitations: [
    'Detection looks for the claude command and ~/.claude; a portable or renamed install may be missed (select it manually).',
    'Loading inside a running session is not verified by the installer; run /skills or ask for a rack task to confirm.',
  ],
  installRoot(scope: Scope, ctx: Context): string {
    return scope === 'user' ? join(configDir(ctx), 'skills') : join(ctx.projectDir, '.claude', 'skills')
  },
  scanRoots(scope: Scope, ctx: Context): string[] {
    return [claudeCode.installRoot(scope, ctx)]
  },
  detect(ctx: Context) {
    const evidence: string[] = []
    const bin = which('claude', ctx)
    if (bin) evidence.push(`claude on PATH`)
    if (isDir(configDir(ctx))) evidence.push(configDir(ctx) === join(ctx.home, '.claude') ? '~/.claude exists' : '$CLAUDE_CONFIG_DIR exists')
    return { present: evidence.length > 0, evidence }
  },
  activation(): string {
    return 'Detected live in running sessions. If the skills folder did not exist when the session started, run /reload-skills or restart Claude Code.'
  },
  invocation: '/rack-cabling-designer, or describe a rack/cabling task',
  specificFiles: [],
  check(skillDir: string): CheckResult[] {
    try {
      const fm = parseSkill(readFileSync(join(skillDir, 'SKILL.md'), 'utf8')).frontmatter
      const chars = String(fm.description ?? '').length
      return [{ name: 'Claude Code listing budget', status: chars <= LISTING_MAX_CHARS ? 'pass' : 'warn', detail: `description ${chars}/${LISTING_MAX_CHARS} characters` }]
    } catch (e) {
      return [{ name: 'Claude Code listing budget', status: 'fail', detail: (e as Error).message }]
    }
  },
}
