// Operation log: every step of a real run is recorded as one JSON line in
// <state>/logs/<timestamp>-<mode>.jsonl. Dry runs keep the log in memory only (nothing written).

import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const KEEP_LOGS = 20

export interface LogEntry { time: string; level: 'info' | 'warn' | 'error'; op: string; path?: string; detail?: string }

export class OperationLog {
  readonly entries: LogEntry[] = []
  readonly file?: string

  /** `dir` undefined = in-memory only (dry run, tests). */
  constructor(dir: string | undefined, mode: string) {
    if (!dir) return
    try {
      mkdirSync(dir, { recursive: true })
      this.file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${mode}.jsonl`)
      prune(dir)
    } catch {
      this.file = undefined // logging must never break an installation
    }
  }

  add(level: LogEntry['level'], op: string, path?: string, detail?: string): void {
    const entry: LogEntry = { time: new Date().toISOString(), level, op, path, detail }
    this.entries.push(entry)
    if (!this.file) return
    try {
      appendFileSync(this.file, JSON.stringify(entry) + '\n', 'utf8')
    } catch {
      // keep going; the in-memory log is still printed on failure
    }
  }
}

function prune(dir: string): void {
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()
  for (const old of files.slice(0, Math.max(0, files.length - KEEP_LOGS + 1))) rmSync(join(dir, old), { force: true })
}
