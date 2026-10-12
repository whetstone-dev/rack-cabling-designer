// Human-readable installer output.

import { adapterFor } from '../adapters/index.ts'
import { pretty } from './context.ts'
import type { ExecResult } from './execute.ts'
import { operationsFor, type Plan } from './plan.ts'
import type { CheckResult, Context } from './types.ts'

function table(rows: string[][]): string {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)))
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join('  ')).join('\n')
}

const ACTION_TEXT: Record<string, string> = {
  install: 'install', update: 'update', unchanged: 'up to date', reinstall: 'reinstall', replace: 'replace', link: 'link (dev)', blocked: 'BLOCKED',
}

export function formatPlan(plan: Plan, ctx: Context): string {
  const rows = [['Assistant(s)', 'Destination', 'Action', 'Details']]
  for (const t of plan.targets) {
    rows.push([t.agents.map((a) => adapterFor(a).displayName).join(' + '), pretty(t.dir, ctx), ACTION_TEXT[t.action] ?? t.action, t.reason ?? ''])
  }
  const lines = [`Plan (${plan.scope} scope, ${plan.mode}, v${plan.version}):`, '', table(rows), '', 'Visibility after this operation:']
  for (const v of plan.visibility) {
    const name = adapterFor(v.agent).displayName
    const selected = plan.serves[v.agent] ? '' : ' (not selected)'
    lines.push(`  ${name}${selected}: ${v.dirs.length ? v.dirs.map((d) => pretty(d, ctx)).join(', ') : 'no copy'}`)
  }
  for (const w of plan.warnings) lines.push(`\n⚠ ${w}`)
  return lines.join('\n')
}

const ICON = { pass: 'ok  ', warn: 'warn', fail: 'FAIL' }

export function formatChecks(checks: CheckResult[], indent = '    '): string {
  return checks.map((c) => `${indent}${ICON[c.status]} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`).join('\n')
}

export function formatResults(results: ExecResult[], ctx: Context): string {
  return results.map((r) => {
    const head = `${r.ok ? '✔' : '✖'} ${r.agents.map((a) => adapterFor(a).displayName).join(' + ')}: ${pretty(r.dir, ctx)} — ${r.action}: ${r.message}${r.backup ? `\n    backup: ${pretty(r.backup, ctx)}` : ''}`
    return r.checks.length ? `${head}\n${formatChecks(r.checks)}` : head
  }).join('\n')
}

/** Review step: every file that will be copied, grouped by top folder, with sizes. */
export function formatFiles(plan: Plan): string {
  const groups = new Map<string, { n: number; bytes: number; files: string[] }>()
  for (const f of plan.files) {
    const top = f.path.includes('/') ? f.path.split('/')[0] + '/' : '(root)'
    const g = groups.get(top) ?? { n: 0, bytes: 0, files: [] }
    g.n++; g.bytes += f.bytes; g.files.push(f.path)
    groups.set(top, g)
  }
  const total = plan.files.reduce((s, f) => s + f.bytes, 0)
  const lines = [`Files to install (${plan.files.length} files, ${Math.ceil(total / 1024)} KB, identical for every assistant):`]
  for (const [top, g] of groups) {
    lines.push(`  ${top.padEnd(12)} ${String(g.n).padStart(3)} files  ${String(Math.ceil(g.bytes / 1024)).padStart(4)} KB`)
    for (const f of g.files) lines.push(`      ${f}`)
  }
  lines.push('  + .rcd-install.json (install receipt: version, assistants, file hashes)')
  return lines.join('\n')
}

/** Simulation: the exact operations per destination, in order. */
export function formatOperations(plan: Plan, ctx: Context): string {
  const lines = ['Operations:']
  for (const t of plan.targets) {
    lines.push(`  ${pretty(t.dir, ctx)}`)
    operationsFor(plan, t, ctx).forEach((o, i) => lines.push(`    ${i + 1}. ${o.op.padEnd(12)} ${o.detail}`))
  }
  return lines.join('\n')
}
