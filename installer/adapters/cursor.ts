// Cursor adapter (editor 2.4+ and CLI).
// Native paths: ~/.cursor/skills and .cursor/skills. Cursor also reads .agents/skills and, for
// compatibility, .claude/skills and .codex/skills (user and project), so a copy installed for
// Claude Code or Codex is already visible to Cursor. Skills are discovered at startup.
// Source: https://cursor.com/docs/context/skills, https://cursor.com/changelog/2-4 (checked 2026-10-12).
// Not documented (verify manually): precedence between duplicate copies, hot reload, CLI roots.

import { join } from 'node:path'
import { isDir, which } from '../lib/context.ts'
import type { Adapter, CheckResult, Context, Scope } from '../lib/types.ts'

export const cursor: Adapter = {
  id: 'cursor',
  displayName: 'Cursor',
  docs: ['https://cursor.com/docs/context/skills', 'https://cursor.com/changelog/2-4'],
  limitations: [
    'The Cursor version cannot be read from disk; Agent Skills need Cursor 2.4 or newer.',
    'Loading is not verified (no CLI check); reload the window and type / in Agent chat to confirm.',
    'Precedence between duplicate copies in compatibility folders is not documented.',
  ],
  installRoot(scope: Scope, ctx: Context): string {
    return scope === 'user' ? join(ctx.home, '.cursor', 'skills') : join(ctx.projectDir, '.cursor', 'skills')
  },
  scanRoots(scope: Scope, ctx: Context): string[] {
    const base = scope === 'user' ? ctx.home : ctx.projectDir
    return ['.cursor', '.agents', '.claude', '.codex'].map((d) => join(base, d, 'skills'))
  },
  detect(ctx: Context) {
    const evidence: string[] = []
    if (which('cursor', ctx)) evidence.push('cursor on PATH')
    if (which('cursor-agent', ctx)) evidence.push('cursor-agent on PATH')
    if (isDir(join(ctx.home, '.cursor'))) evidence.push('~/.cursor exists')
    return { present: evidence.length > 0, evidence }
  },
  activation(): string {
    return 'Restart Cursor or reload the window (skills are discovered at startup). Requires Cursor 2.4 or newer.'
  },
  invocation: '/rack-cabling-designer in Agent chat, or describe a rack/cabling task',
  specificFiles: [],
  check(): CheckResult[] {
    return [{ name: 'Cursor version', status: 'warn', detail: 'cannot be read from disk; Agent Skills need Cursor 2.4+ (Jan 2026)' }]
  },
}
