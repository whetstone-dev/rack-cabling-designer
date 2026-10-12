// Uninstall: driven by the install receipt. Removes only files this installer wrote, never
// follows links when deleting, never removes the skills root, the project or files the user
// added. Copies still used by another assistant are kept.

import { readdirSync, rmdirSync, rmSync, unlinkSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { adapterFor } from '../adapters/index.ts'
import { exists, isDir, isLink } from './context.ts'
import { inspectExisting, SKILL_NAME } from './detect.ts'
import { explainFsError } from './errors.ts'
import type { ExecResult } from './execute.ts'
import type { OperationLog } from './log.ts'
import { RECEIPT_FILE } from './manifest.ts'
import { samePath } from './plan.ts'
import { writeReceipt } from './receipt.ts'
import type { AgentId, Context, Scope } from './types.ts'

/** Remove empty folders from `dir` upwards, stopping at (and never removing) `stop`. */
function pruneEmpty(dir: string, stop: string): void {
  let current = dir
  for (;;) {
    const rel = relative(stop, current)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return
    try {
      if (readdirSync(current).length > 0) return
      rmdirSync(current)
    } catch {
      return
    }
    current = dirname(current)
  }
}

function removeOurFiles(dir: string, files: string[], log: OperationLog): string[] {
  const leftovers: string[] = []
  for (const f of [...files, RECEIPT_FILE]) {
    if (f.split('/').includes('..') || isAbsolute(f)) { leftovers.push(`${f} (unsafe path in receipt, skipped)`); continue }
    const p = join(dir, ...f.split('/'))
    try {
      if (isLink(p)) unlinkSync(p)
      else rmSync(p, { force: true })
      pruneEmpty(dirname(p), dir)
    } catch (e) {
      leftovers.push(`${f} (${explainFsError(e, p)})`)
    }
  }
  try {
    const rest = readdirSync(dir, { recursive: true }) as string[]
    if (rest.length === 0) rmdirSync(dir)
    else leftovers.push(...rest.filter((r) => !isDir(join(dir, r))).map((r) => `${r} (not installed by us, kept)`))
  } catch {
    // folder already gone
  }
  log.add(leftovers.length ? 'warn' : 'info', 'remove', dir, leftovers.length ? `kept: ${leftovers.join(', ')}` : `${files.length} files removed`)
  return leftovers
}

export function uninstall(agents: AgentId[], scope: Scope, payloadDir: string, ctx: Context, opts: { force: boolean; dryRun: boolean; log: OperationLog }): ExecResult[] {
  const { log } = opts
  const results: ExecResult[] = []
  const seen: string[] = []
  log.add('info', 'start', undefined, `uninstall ${agents.join(', ')}, ${scope} scope${opts.dryRun ? ' (dry run)' : ''}`)
  for (const id of agents) {
    const adapter = adapterFor(id)
    for (const root of adapter.scanRoots(scope, ctx)) {
      const dir = join(root, SKILL_NAME)
      if (!exists(dir) || seen.some((s) => samePath(s, dir, ctx))) continue
      const existing = inspectExisting(dir, ctx)
      const native = samePath(root, adapter.installRoot(scope, ctx), ctx)
      const servesAgent = existing.kind === 'ours' ? existing.receipt!.agents.includes(id) : native
      if (!servesAgent) continue
      seen.push(dir)
      const r: ExecResult = { dir, agents: [id], action: 'remove', ok: true, message: '', checks: [] }
      try {
        if (existing.kind === 'link') {
          const ourLink = !!existing.linkTarget && samePath(resolve(dirname(dir), existing.linkTarget), resolve(payloadDir), ctx)
          if (!ourLink && !opts.force) { r.ok = false; r.action = 'blocked'; r.message = `is a link${existing.managedBy ? ` managed by ${existing.managedBy}` : ''} to ${existing.linkTarget}; use --force to remove the link (its target is never touched)` }
          else { r.message = 'link removed (target untouched)'; if (!opts.dryRun) { unlinkSync(dir); log.add('info', 'remove-link', dir, existing.linkTarget) } }
        } else if (existing.kind === 'foreign') {
          r.ok = false; r.action = 'blocked'; r.message = `not installed by this installer (${existing.managedBy}); it is never deleted automatically, remove it yourself if you are sure`
        } else {
          const receipt = existing.receipt!
          const remaining = receipt.agents.filter((a) => !agents.includes(a))
          if (remaining.length > 0) {
            r.action = 'kept'
            r.message = `still used by ${remaining.map((a) => adapterFor(a).displayName).join(', ')}; ${adapter.displayName} keeps seeing it while it exists`
            if (!opts.dryRun) { writeReceipt(dir, { ...receipt, agents: remaining }); log.add('info', 'update-receipt', dir, `assistants: ${remaining.join(', ')}`) }
          } else {
            const leftovers = opts.dryRun ? [] : removeOurFiles(dir, Object.keys(receipt.files), log)
            r.message = opts.dryRun
              ? `would remove ${Object.keys(receipt.files).length} files of v${receipt.version} (files you added would be kept)`
              : leftovers.length ? `removed v${receipt.version}; kept ${leftovers.length} item(s): ${leftovers.slice(0, 3).join(', ')}` : `removed v${receipt.version}`
          }
        }
      } catch (e) {
        r.ok = false
        r.message = explainFsError(e, dir)
        log.add('error', 'failed', dir, r.message)
      }
      if (r.action === 'blocked') log.add('warn', 'skip', dir, r.message)
      results.push(r)
    }
  }
  log.add('info', 'end', undefined, `${results.length} copy(ies) processed`)
  return results
}
