// Planning (pure, read-only): which folders to write, which assistants share a copy, what
// happens to whatever is already there, the exact operations, and which assistants will see
// which copies afterwards. The same operations are printed by --dry-run and logged on execution.

import { join } from 'node:path'
import { adapterFor, adaptersFor } from '../adapters/index.ts'
import { exists, isDir, pretty } from './context.ts'
import { inspectExisting, SKILL_NAME, type Existing } from './detect.ts'
import { isClean } from './manifest.ts'
import { compareVersions } from './receipt.ts'
import type { AgentId, Context, Scope } from './types.ts'

export { SKILL_NAME } from './detect.ts'

export type Action = 'install' | 'update' | 'unchanged' | 'reinstall' | 'replace' | 'link' | 'blocked'

/** Why a target is blocked; "authorizable" ones can be unblocked by explicit user consent. */
export type BlockReason = 'foreign' | 'link' | 'modified' | 'newer' | 'installed-copy' | 'invalid-root'

export interface Target {
  root: string
  dir: string
  agents: AgentId[]
  existing: Existing
  action: Action
  reason?: string
  block?: BlockReason
}

export interface Operation { dir: string; op: string; detail: string }

export interface PayloadFile { path: string; bytes: number }

export interface Plan {
  scope: Scope
  mode: 'copy' | 'link'
  version: string
  targets: Target[]
  /** for each selected agent, the folder that serves it */
  serves: Record<string, string>
  /** for every known agent, the copies it will see after the operation */
  visibility: { agent: AgentId; dirs: string[] }[]
  warnings: string[]
  files: PayloadFile[]
}

export interface PlanOptions {
  scope: Scope
  agents: AgentId[]
  version: string
  mode?: 'copy' | 'link'
  force?: boolean
  share?: boolean
  files?: PayloadFile[]
}

export function samePath(a: string, b: string, ctx: Pick<Context, 'platform'>): boolean {
  const n = (p: string): string => (ctx.platform === 'win32' ? p.replace(/\//g, '\\').toLowerCase() : p).replace(/[\\/]+$/, '')
  return n(a) === n(b)
}

function decide(t: Target, version: string, mode: 'copy' | 'link', force: boolean): void {
  const e = t.existing
  const link = mode === 'link'
  t.block = undefined
  const block = (why: BlockReason, reason: string): void => { t.action = 'blocked'; t.block = why; t.reason = reason }
  if (e.kind === 'none') { t.action = link ? 'link' : 'install'; t.reason = undefined; return }
  if (e.kind === 'link' || e.kind === 'foreign') {
    const what = e.kind === 'link' ? `a link${e.linkTarget ? ` to ${e.linkTarget}` : ''}` : 'a copy not installed by this installer'
    const who = e.managedBy ? ` (${e.managedBy})` : ''
    if (force) { t.action = link ? 'link' : 'replace'; t.reason = `replaces ${what}${who}; it is backed up first` }
    else block(e.kind, `contains ${what}${who}. ${e.managedBy === 'npx skills' ? 'Update it with "npx skills update", or ' : ''}authorize a backup + replace (--force)`)
    return
  }
  const installed = e.receipt!.version
  const cmp = compareVersions(version, installed)
  const dirty = !!e.diff && !isClean(e.diff)
  if (link) {
    if (force) { t.action = 'link'; t.reason = `replaces installed v${installed} (backed up)` }
    else block('installed-copy', `contains installed v${installed}; authorize replacing it with a development link (--force)`)
    return
  }
  if (dirty && !force) { block('modified', `installed v${installed} has local changes (${[...e.diff!.modified, ...e.diff!.missing].slice(0, 3).join(', ')}); authorize a backup + reinstall (--force)`); return }
  if (cmp > 0) { t.action = 'update'; t.reason = `v${installed} → v${version}${dirty ? ' (local changes backed up)' : ''}` }
  else if (cmp < 0) {
    if (force) { t.action = 'reinstall'; t.reason = `downgrade v${installed} → v${version} (backed up)` }
    else block('newer', `installed v${installed} is newer than v${version}; authorize a downgrade (--force)`)
  } else if (force || dirty) { t.action = 'reinstall'; t.reason = `v${installed} again (backed up)` }
  else { t.action = 'unchanged'; t.reason = `v${installed} already installed and intact` }
}

/** Blocked targets that explicit consent can unblock (an invalid destination never can). */
export function authorizable(t: Target): boolean {
  return t.action === 'blocked' && t.block !== 'invalid-root'
}

/** Explicit consent for one blocked target (interactive authorization or --force). */
export function authorize(plan: Plan, t: Target): void {
  if (authorizable(t)) decide(t, plan.version, plan.mode, true)
}

export function computePlan(opts: PlanOptions, ctx: Context): Plan {
  const share = opts.share !== false
  const mode = opts.mode ?? 'copy'
  const targets: Target[] = []
  const serves: Record<string, string> = {}
  const order = adaptersFor(ctx).map((a) => a.id).filter((id) => opts.agents.includes(id))

  for (const id of order) {
    const adapter = adapterFor(id)
    const native = adapter.installRoot(opts.scope, ctx)
    // Share an already-planned copy when this platform scans its folder (fewest copies wins).
    let target = share
      ? adapter.scanRoots(opts.scope, ctx).map((root) => targets.find((t) => samePath(t.root, root, ctx))).find((t) => !!t)
      : undefined
    target ??= targets.find((t) => samePath(t.root, native, ctx))
    if (!target) {
      const dir = join(native, SKILL_NAME)
      target = { root: native, dir, agents: [], existing: inspectExisting(dir, ctx), action: 'install' }
      if (exists(native) && !isDir(native)) {
        target.action = 'blocked'
        target.block = 'invalid-root'
        target.reason = `${native} is a file where a folder was expected; move it away or choose another scope or folder`
      } else decide(target, opts.version, mode, !!opts.force)
      targets.push(target)
    }
    target.agents.push(id)
    serves[id] = target.dir
  }

  const plan: Plan = { scope: opts.scope, mode, version: opts.version, targets, serves, visibility: [], warnings: [], files: opts.files ?? [] }
  refreshVisibility(plan, ctx)
  return plan
}

/** Recompute who sees which copies (call again after authorizing targets). */
export function refreshVisibility(plan: Plan, ctx: Context): void {
  plan.visibility = adaptersFor(ctx).map((a) => {
    const dirs: string[] = []
    for (const root of a.scanRoots(plan.scope, ctx)) {
      const dir = join(root, SKILL_NAME)
      const planned = plan.targets.some((t) => samePath(t.dir, dir, ctx) && t.action !== 'blocked')
      if ((planned || exists(dir)) && !dirs.some((d) => samePath(d, dir, ctx))) dirs.push(dir)
    }
    return { agent: a.id, dirs }
  })
  plan.warnings = plan.visibility
    .filter((v) => v.dirs.length > 1)
    .map((v) => `${adapterFor(v.agent).displayName} will see ${v.dirs.length} copies (${v.dirs.map((d) => pretty(d, ctx)).join(', ')}). Precedence between duplicates is not documented for every platform; identical versions behave the same, but keep them in sync or remove extras.`)
}

/** The concrete steps for one target, in execution order. Used by --dry-run and the log. */
export function operationsFor(plan: Plan, t: Target, ctx: Context): Operation[] {
  const ops: Operation[] = []
  const add = (op: string, detail: string): void => { ops.push({ dir: t.dir, op, detail }) }
  const kb = Math.ceil(plan.files.reduce((s, f) => s + f.bytes, 0) / 1024)
  switch (t.action) {
    case 'blocked':
      add('skip', `blocked: ${t.reason}`)
      return ops
    case 'unchanged':
      add('verify', 'check files, format, Node.js and self-test')
      return ops
  }
  if (!exists(t.root)) add('mkdir', pretty(t.root, ctx))
  if (t.existing.kind === 'link') add('remove-link', `${pretty(t.dir, ctx)} → ${t.existing.linkTarget ?? '?'} (target untouched, link recorded for rollback)`)
  else if (t.existing.kind !== 'none') add('backup', `move ${pretty(t.dir, ctx)} to ${pretty(join(ctx.stateDir, 'backups'), ctx)}/… (last 3 kept)`)
  if (plan.mode === 'link') add('link', `${pretty(t.dir, ctx)} → this checkout (${ctx.platform === 'win32' ? 'directory junction, no admin rights' : 'symlink'})`)
  else {
    add('stage', `copy ${plan.files.length} files (${kb} KB) to ${pretty(join(ctx.stateDir, 'staging'), ctx)} and check their hashes`)
    add('receipt', `write .rcd-install.json (version, scope, assistants: ${t.agents.join(', ')}, file hashes)`)
    add('place', `move the staged copy to ${pretty(t.dir, ctx)}`)
  }
  add('verify', 'check files, format, Node.js and self-test; roll back on failure')
  return ops
}
