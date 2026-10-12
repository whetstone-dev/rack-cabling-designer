// Execution: apply a plan. Per target: stage a copy outside every skills root, back up what
// is there, put the new copy in place, verify, and roll back on any failure. Every step is
// logged. Only targets the plan marks as actionable are touched; blocked ones are skipped.

import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { exists, isDir, isLink } from './context.ts'
import { SKILL_NAME } from './detect.ts'
import { explainFsError } from './errors.ts'
import type { OperationLog } from './log.ts'
import { diffFiles, isClean, type Manifest } from './manifest.ts'
import type { Plan, Target } from './plan.ts'
import { writeReceipt, type Receipt } from './receipt.ts'
import type { AgentId, CheckResult, Context } from './types.ts'
import { InstallerError } from './types.ts'
import { verifyCopy } from './verify.ts'

const KEEP_BACKUPS = 3

export interface ExecResult {
  dir: string
  agents: AgentId[]
  action: string
  ok: boolean
  message: string
  backup?: string
  checks: CheckResult[]
}

interface Backup { path?: string; linkTarget?: string; description: string }

class VerificationFailed extends Error {
  checks: CheckResult[]
  constructor(checks: CheckResult[]) {
    super(`verification failed (${checks.filter((c) => c.status === 'fail').map((c) => c.name).join(', ')})`)
    this.checks = checks
  }
}

/** Rename, falling back to copy + delete across volumes (e.g. project on another drive). */
export function move(src: string, dst: string): void {
  try {
    renameSync(src, dst)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
    cpSync(src, dst, { recursive: true, verbatimSymlinks: true })
    rmSync(src, { recursive: true, force: true })
  }
}

function slug(p: string): string {
  return p.replace(/[:\\/]+/g, '_').replace(/^_+/, '').slice(-120)
}

/** Move an existing folder out of every skills root (or remove a link, remembering its target). */
function backupExisting(t: Target, ctx: Context, log: OperationLog): Backup | undefined {
  if (!exists(t.dir)) return undefined
  if (isLink(t.dir)) {
    const linkTarget = readlinkSync(t.dir)
    unlinkSync(t.dir) // removes the link only, never its target
    log.add('info', 'remove-link', t.dir, `was a link to ${linkTarget}`)
    return { linkTarget, description: `previous link to ${linkTarget} removed` }
  }
  const version = t.existing.receipt?.version ?? 'unknown'
  const base = join(ctx.stateDir, 'backups', slug(t.root))
  mkdirSync(base, { recursive: true })
  const dest = join(base, `${new Date().toISOString().replace(/[:.]/g, '-')}_v${version}`)
  move(t.dir, dest)
  log.add('info', 'backup', t.dir, dest)
  const entries = readdirSync(base).sort()
  for (const old of entries.slice(0, Math.max(0, entries.length - KEEP_BACKUPS))) {
    rmSync(join(base, old), { recursive: true, force: true })
    log.add('info', 'prune-backup', join(base, old))
  }
  return { path: dest, description: dest }
}

function stageCopy(payloadDir: string, manifest: Manifest, ctx: Context, receipt: Receipt, log: OperationLog): string {
  mkdirSync(join(ctx.stateDir, 'staging'), { recursive: true })
  const stage = mkdtempSync(join(ctx.stateDir, 'staging', 'rcd-'))
  for (const f of Object.keys(manifest.files)) {
    const dst = join(stage, ...f.split('/'))
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(join(payloadDir, ...f.split('/')), dst)
  }
  writeReceipt(stage, receipt)
  const d = diffFiles(stage, manifest.files)
  if (!isClean(d)) throw new InstallerError(`staged copy does not match the manifest (${[...d.missing, ...d.modified].join(', ')})`)
  log.add('info', 'stage', stage, `${Object.keys(manifest.files).length} files copied and hash-checked`)
  return stage
}

/** Remove staging folders left by an aborted earlier run (they live only in our state folder). */
function cleanStaleStaging(ctx: Context, log: OperationLog): void {
  const dir = join(ctx.stateDir, 'staging')
  let entries: string[] = []
  try { entries = readdirSync(dir) } catch { return }
  for (const e of entries.filter((x) => x.startsWith('rcd-'))) {
    rmSync(join(dir, e), { recursive: true, force: true })
    log.add('info', 'clean-staging', join(dir, e), 'left by an interrupted run')
  }
}

export interface ExecOptions {
  selftest: boolean
  log: OperationLog
  /** Checked between destinations (Ctrl+C): stop before starting the next one */
  shouldStop?: () => boolean
}

export function executePlan(plan: Plan, payloadDir: string, manifest: Manifest, ctx: Context, opts: ExecOptions): ExecResult[] {
  const { log } = opts
  const results: ExecResult[] = []
  log.add('info', 'start', undefined, `${plan.mode} v${plan.version}, ${plan.scope} scope, ${plan.targets.length} destination(s)`)
  cleanStaleStaging(ctx, log)
  for (const t of plan.targets) {
    if (opts.shouldStop?.()) {
      log.add('warn', 'cancelled', t.dir, 'not started: interrupted by the user')
      results.push({ dir: t.dir, agents: t.agents, action: 'cancelled', ok: false, message: 'not started: interrupted by the user; nothing was written here', checks: [] })
      continue
    }
    if (t.action === 'blocked') {
      log.add('warn', 'skip', t.dir, t.reason)
      results.push({ dir: t.dir, agents: t.agents, action: t.action, ok: false, message: t.reason ?? 'blocked', checks: [] })
      continue
    }
    if (t.action === 'unchanged') {
      // Keep the receipt's assistant list current when a new assistant now shares this copy.
      const r = t.existing.receipt
      if (r && t.agents.some((a) => !r.agents.includes(a))) {
        writeReceipt(t.dir, { ...r, agents: [...new Set([...r.agents, ...t.agents])] })
        log.add('info', 'update-receipt', t.dir, `assistants: ${[...new Set([...r.agents, ...t.agents])].join(', ')}`)
      }
      const checks = verifyCopy(t.dir, t.agents, ctx, { selftest: opts.selftest, expected: manifest.files })
      log.add(checks.some((c) => c.status === 'fail') ? 'error' : 'info', 'verify', t.dir, summarize(checks))
      results.push({ dir: t.dir, agents: t.agents, action: t.action, ok: !checks.some((c) => c.status === 'fail'), message: t.reason ?? 'unchanged', checks })
      continue
    }

    let backup: Backup | undefined
    let stage: string | undefined
    let placed = false
    try {
      const previousAgents = t.existing.receipt?.agents ?? []
      if (plan.mode === 'copy') {
        stage = stageCopy(payloadDir, manifest, ctx, {
          receiptVersion: 1, name: SKILL_NAME, version: manifest.version, installedAt: new Date().toISOString(),
          scope: plan.scope, agents: [...new Set([...previousAgents, ...t.agents])], source: resolve(payloadDir), files: manifest.files,
        }, log)
      }
      if (!exists(t.root)) { mkdirSync(t.root, { recursive: true }); log.add('info', 'mkdir', t.root) }
      backup = backupExisting(t, ctx, log)
      if (plan.mode === 'copy') { move(stage!, t.dir); log.add('info', 'place', t.dir) }
      else { symlinkSync(resolve(payloadDir), t.dir, ctx.platform === 'win32' ? 'junction' : 'dir'); log.add('info', 'link', t.dir, resolve(payloadDir)) }
      stage = undefined
      placed = true
      const checks = verifyCopy(t.dir, t.agents, ctx, { selftest: opts.selftest, expected: manifest.files, ourLinkTarget: plan.mode === 'link' ? resolve(payloadDir) : undefined })
      if (checks.some((c) => c.status === 'fail')) throw new VerificationFailed(checks)
      log.add('info', 'verify', t.dir, summarize(checks))
      results.push({ dir: t.dir, agents: t.agents, action: t.action, ok: true, message: t.reason ?? 'done', backup: backup?.description, checks })
    } catch (e) {
      const checks = e instanceof VerificationFailed ? e.checks : []
      const message = e instanceof VerificationFailed || e instanceof InstallerError ? (e as Error).message : explainFsError(e)
      log.add('error', 'failed', t.dir, message)
      // Roll back: remove only what this run put in place, then restore the backup.
      try {
        if (placed) {
          if (isLink(t.dir)) unlinkSync(t.dir)
          else rmSync(t.dir, { recursive: true, force: true })
        }
        if (backup?.path && isDir(backup.path) && !exists(t.dir)) move(backup.path, t.dir)
        if (backup?.linkTarget && !exists(t.dir)) symlinkSync(backup.linkTarget, t.dir, ctx.platform === 'win32' ? 'junction' : 'dir')
        log.add('info', 'rollback', t.dir, backup ? `restored ${backup.description}` : 'nothing to restore')
      } catch (rollbackError) {
        const detail = explainFsError(rollbackError)
        checks.push({ name: 'rollback', status: 'fail', detail })
        log.add('error', 'rollback-failed', t.dir, `${detail}; backup kept at ${backup?.path ?? 'n/a'}`)
      }
      if (stage) rmSync(stage, { recursive: true, force: true })
      results.push({ dir: t.dir, agents: t.agents, action: t.action, ok: false, message: `failed and rolled back: ${message}`, backup: backup?.description, checks })
    }
  }
  log.add('info', 'end', undefined, `${results.filter((r) => r.ok).length}/${results.length} destination(s) ok`)
  return results
}

function summarize(checks: CheckResult[]): string {
  return checks.map((c) => `${c.name}: ${c.status}`).join('; ')
}
