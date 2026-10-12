// Verification of one installed copy: format, integrity, runtime and platform checks.
// Security rule: the toolkit self-test (the only code the installer ever runs) is executed
// only for copies whose files match this installer's receipt, or for a link to this checkout.
// Foreign or modified copies are inspected read-only and never executed.

import { spawnSync } from 'node:child_process'
import { readlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { adapterFor } from '../adapters/index.ts'
import { exists, isLink } from './context.ts'
import { diffFiles } from './manifest.ts'
import { samePath } from './plan.ts'
import { readReceipt } from './receipt.ts'
import { checkSkill, skillVersion } from './skill-format.ts'
import type { AgentId, CheckResult, Context } from './types.ts'

const MIN_NODE: [number, number] = [22, 18]

export function nodeVersionOk(version = process.versions.node): boolean {
  const [major, minor] = version.split('.').map(Number)
  return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1])
}

export interface VerifyOptions {
  selftest: boolean
  /** Manifest hashes of the payload being installed, to flag copies of another version */
  expected?: Record<string, string>
  /** Resolved checkout path: a link pointing here is ours and may be executed */
  ourLinkTarget?: string
}

export function verifyCopy(dir: string, agents: AgentId[], ctx: Context, opts: VerifyOptions): CheckResult[] {
  const out: CheckResult[] = []
  if (!exists(dir)) return [{ name: 'present', status: 'fail', detail: `${dir} does not exist` }]

  const { parsed, issues } = checkSkill(dir)
  const errors = issues.filter((i) => i.level === 'error')
  out.push({ name: 'SKILL.md format', status: errors.length ? 'fail' : issues.length ? 'warn' : 'pass', detail: issues.map((i) => i.message).join('; ') || `name and description valid, v${skillVersion(parsed) ?? '?'}` })

  let trusted = false
  if (isLink(dir)) {
    let target = '?'
    try { target = readlinkSync(dir) } catch { /* unreadable */ }
    trusted = !!opts.ourLinkTarget && samePath(resolve(dirname(dir), target), opts.ourLinkTarget, ctx)
    out.push({ name: 'integrity', status: trusted ? 'pass' : 'warn', detail: trusted ? `development link to this checkout (${target})` : `link to ${target}, not created from this checkout; not verified` })
  } else {
    const receipt = readReceipt(dir)
    if (!receipt) {
      out.push({ name: 'integrity', status: 'warn', detail: 'no install receipt (not installed by this installer); files not verified' })
    } else {
      const d = diffFiles(dir, receipt.files)
      const bad = [...d.missing.map((f) => `missing ${f}`), ...d.modified.map((f) => `modified ${f}`)]
      trusted = bad.length === 0
      out.push({ name: 'integrity', status: bad.length ? 'fail' : d.extra.length ? 'warn' : 'pass', detail: bad.length ? bad.slice(0, 5).join(', ') : d.extra.length ? `${Object.keys(receipt.files).length} files ok; ${d.extra.length} extra file(s): ${d.extra.slice(0, 3).join(', ')}` : `${Object.keys(receipt.files).length} files match (v${receipt.version})` })
      if (trusted && opts.expected && JSON.stringify(receipt.files) !== JSON.stringify(opts.expected)) {
        out.push({ name: 'version', status: 'warn', detail: `installed v${receipt.version} differs from this checkout; run the installer with --update` })
      }
    }
  }

  const nodeOk = nodeVersionOk()
  out.push({ name: 'Node.js for scripts', status: nodeOk ? 'pass' : 'warn', detail: nodeOk ? process.versions.node : `${process.versions.node} < ${MIN_NODE.join('.')}; validators will not run, instructions still work` })

  if (!opts.selftest) {
    out.push({ name: 'rackcab selftest', status: 'warn', detail: 'skipped (--no-selftest)' })
  } else if (!trusted) {
    out.push({ name: 'rackcab selftest', status: 'warn', detail: 'not run: code that is not verified as ours is never executed' })
  } else if (nodeOk) {
    // Runs the installed toolkit with the current Node binary, fixed arguments, no shell.
    const r = spawnSync(process.execPath, [join(dir, 'scripts', 'rackcab.ts'), 'selftest'], { cwd: tmpdir(), encoding: 'utf8', timeout: 120_000, windowsHide: true, shell: false })
    const last = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').pop() ?? ''
    out.push({ name: 'rackcab selftest', status: r.status === 0 ? 'pass' : 'fail', detail: r.error ? r.error.message : last })
  }

  for (const id of agents) out.push(...adapterFor(id).check(dir, ctx))
  return out
}
