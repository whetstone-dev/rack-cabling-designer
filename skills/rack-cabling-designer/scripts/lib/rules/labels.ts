// Labeling rules: every cable labeled, labels unique, matching the policy pattern and color code.

import type { Diagnostic } from '../model.ts'
import type { Index } from '../resolve.ts'

export function checkLabels(ix: Index, out: Diagnostic[]): void {
  const policy = ix.model.policy ?? {}
  let pattern: RegExp | undefined
  if (policy.labelPattern) {
    try {
      pattern = new RegExp(policy.labelPattern)
    } catch (e) {
      out.push({ code: 'RCD-LBL-PATTERN', severity: 'error', message: `policy.labelPattern is not a valid regular expression: ${(e as Error).message}`, path: 'policy.labelPattern' })
    }
  }

  const seen = new Map<string, string>()
  ix.cables.forEach((c, i) => {
    const path = `cables[${i}]`
    if (c.status === 'remove') return
    if (!c.label) {
      out.push({ code: 'RCD-LBL-MISSING', severity: 'warning', message: `Cable "${c.id}" has no label; label sheets fall back to its id.`, path })
    } else {
      const key = c.label.trim().toLowerCase()
      const prev = seen.get(key)
      if (prev) out.push({ code: 'RCD-LBL-DUP', severity: 'error', message: `Label "${c.label}" is used by cables "${prev}" and "${c.id}".`, path: `${path}.label` })
      else seen.set(key, c.id)
      if (pattern && !pattern.test(c.label)) out.push({ code: 'RCD-LBL-PATTERN', severity: 'warning', message: `Label "${c.label}" does not match policy.labelPattern ${policy.labelPattern}.`, path: `${path}.label` })
    }

    const wanted = c.function ? policy.colorByFunction?.[c.function] : undefined
    if (wanted && (c.color ?? '').toLowerCase() !== wanted.toLowerCase()) {
      out.push({ code: 'RCD-LBL-COLOR', severity: 'warning', message: `Cable "${c.id}" (${c.function}) is ${c.color ?? 'uncolored'}; the color code says ${wanted}.`, path: `${path}.color` })
    }
  })
}
