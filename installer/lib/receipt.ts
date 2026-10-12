// Install receipt written inside each installed copy: what was installed, for whom and from where.
// Uninstall only removes files listed here.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RECEIPT_FILE } from './manifest.ts'
import type { AgentId, Scope } from './types.ts'

export interface Receipt {
  receiptVersion: 1
  name: string
  version: string
  installedAt: string
  scope: Scope
  agents: AgentId[]
  source: string
  files: Record<string, string>
}

export function readReceipt(dir: string): Receipt | undefined {
  try {
    const r = JSON.parse(readFileSync(join(dir, RECEIPT_FILE), 'utf8')) as Receipt
    if (r.receiptVersion !== 1 || typeof r.files !== 'object' || !Array.isArray(r.agents)) return undefined
    return r
  } catch {
    return undefined
  }
}

export function writeReceipt(dir: string, r: Receipt): void {
  writeFileSync(join(dir, RECEIPT_FILE), JSON.stringify(r, null, 2) + '\n', 'utf8')
}

/** Numeric SemVer comparison of x.y.z (pre-release suffixes are ignored). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0)
  const pb = b.split(/[.+-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1
  return 0
}
