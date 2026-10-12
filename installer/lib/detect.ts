// Detection (read-only): which assistants are present, and what already exists in each
// skills folder they scan. Nothing here writes, spawns processes or touches the network.

import { readFileSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'
import { adaptersFor } from '../adapters/index.ts'
import { exists, isLink } from './context.ts'
import { diffFiles, type FileDiff } from './manifest.ts'
import { readReceipt, type Receipt } from './receipt.ts'
import type { AgentId, Context, Scope } from './types.ts'

export const SKILL_NAME = 'rack-cabling-designer'

export interface PlatformStatus {
  id: AgentId
  name: string
  present: boolean
  evidence: string[]
  limitations: string[]
}

export interface Existing {
  kind: 'none' | 'ours' | 'link' | 'foreign'
  receipt?: Receipt
  diff?: FileDiff
  linkTarget?: string
  managedBy?: string
}

export interface FoundCopy { dir: string; seenBy: AgentId[]; existing: Existing }

export function detectPlatforms(ctx: Context): PlatformStatus[] {
  return adaptersFor(ctx).map((a) => {
    const d = a.detect(ctx)
    return { id: a.id, name: a.displayName, present: d.present, evidence: d.evidence, limitations: a.limitations }
  })
}

/** True when `npx skills` (vercel-labs/skills) recorded this skill in its global lock file. */
export function managedByNpxSkills(ctx: Context): boolean {
  const candidates = [join(ctx.home, '.agents', '.skill-lock.json')]
  if (ctx.env.XDG_STATE_HOME) candidates.push(join(ctx.env.XDG_STATE_HOME, 'skills', '.skill-lock.json'))
  for (const f of candidates) {
    try {
      const lock = JSON.parse(readFileSync(f, 'utf8')) as { skills?: Record<string, unknown> }
      if (lock.skills && Object.hasOwn(lock.skills, SKILL_NAME)) return true
    } catch {
      // no lock file or unreadable: not managed by npx skills
    }
  }
  return false
}

/** Classify what is at `dir`: nothing, our install (with integrity diff), a link, or someone else's copy. */
export function inspectExisting(dir: string, ctx: Context): Existing {
  if (!exists(dir)) return { kind: 'none' }
  if (isLink(dir)) {
    let linkTarget: string | undefined
    try {
      linkTarget = readlinkSync(dir)
    } catch {
      linkTarget = undefined
    }
    return { kind: 'link', linkTarget, managedBy: managedByNpxSkills(ctx) ? 'npx skills' : undefined }
  }
  const receipt = readReceipt(dir)
  if (receipt && receipt.name === SKILL_NAME) return { kind: 'ours', receipt, diff: diffFiles(dir, receipt.files) }
  return { kind: 'foreign', managedBy: managedByNpxSkills(ctx) ? 'npx skills' : 'manual copy or another installer' }
}

/** Every existing copy of the skill in the folders the given platforms scan, with who sees it. */
export function findCopies(scope: Scope, agents: AgentId[], ctx: Context): FoundCopy[] {
  const found: FoundCopy[] = []
  for (const a of adaptersFor(ctx).filter((x) => agents.includes(x.id))) {
    for (const root of a.scanRoots(scope, ctx)) {
      const dir = join(root, SKILL_NAME)
      if (!exists(dir)) continue
      const hit = found.find((f) => f.dir === dir)
      if (hit) { if (!hit.seenBy.includes(a.id)) hit.seenBy.push(a.id) }
      else found.push({ dir, seenBy: [a.id], existing: inspectExisting(dir, ctx) })
    }
  }
  return found
}
