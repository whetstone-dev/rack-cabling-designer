// Adapter registry. Order matters: it is the order of installation and of sharing decisions.
// To support a new platform, add one adapter file here (paths, scan roots, detection,
// limitations, checks); detection, planning, execution and verification need no changes.

import type { Adapter, AgentId, Context } from '../lib/types.ts'
import { InstallerError } from '../lib/types.ts'
import { claudeCode } from './claude-code.ts'
import { codex } from './codex.ts'
import { cursor } from './cursor.ts'
import { custom } from './custom.ts'

/** Platforms with verified conventions, shown in every selection menu. */
export const ADAPTERS: Adapter[] = [claudeCode, codex, cursor]

/** Known platforms plus the custom folder when the user chose one. */
export function adaptersFor(ctx: Context): Adapter[] {
  return ctx.customRoot ? [...ADAPTERS, custom] : ADAPTERS
}

export function adapterFor(id: string): Adapter {
  if (id === 'custom') return custom
  const hit = ADAPTERS.find((a) => a.id === id)
  if (!hit) throw new InstallerError(`Unknown assistant "${id}". Use: ${[...ADAPTERS.map((a) => a.id), 'custom'].join(', ')}.`)
  return hit
}

export function isAgentId(id: string): id is AgentId {
  return id === 'custom' || ADAPTERS.some((a) => a.id === id)
}
