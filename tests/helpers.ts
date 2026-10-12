// Test sandbox: a temporary home, project, state folder and PATH so the installer never touches
// the real user profile.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext } from '../installer/lib/context.ts'
import type { Context } from '../installer/lib/types.ts'

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const PAYLOAD = join(REPO, 'skills', 'rack-cabling-designer')
export const INSTALLER = join(REPO, 'installer', 'install.ts')

export interface Sandbox {
  root: string
  home: string
  project: string
  state: string
  bin: string
  env: Record<string, string>
  ctx(scope?: 'project'): Context
  run(args: string[], input?: string): { status: number | null; out: string }
  fakeBinary(name: string): void
  files(): string[]
}

export function sandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'rcd-test-'))
  const home = join(root, 'home')
  const project = join(root, 'project')
  const state = join(root, 'state')
  const bin = join(root, 'bin')
  for (const d of [home, project, bin]) mkdirSync(d, { recursive: true })
  const env: Record<string, string> = {
    RCD_INSTALL_HOME: home,
    RCD_INSTALL_STATE: state,
    PATH: bin,
    PATHEXT: '.CMD;.EXE',
    SystemRoot: process.env.SystemRoot ?? '',
    TEMP: process.env.TEMP ?? tmpdir(),
    TMP: process.env.TMP ?? tmpdir(),
  }
  return {
    root, home, project, state, bin, env,
    ctx: () => createContext({ projectDir: project, env }),
    run(args: string[], input?: string) {
      // With `input`, drive the interactive menu through piped stdin.
      const runEnv = input === undefined ? env : { ...env, RCD_FORCE_INTERACTIVE: '1' }
      const r = spawnSync(process.execPath, [INSTALLER, ...args], { cwd: project, env: runEnv, input: input ?? '', encoding: 'utf8', timeout: 120_000 })
      return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
    },
    fakeBinary(name: string) {
      writeFileSync(join(bin, process.platform === 'win32' ? `${name}.cmd` : name), '')
    },
    files() {
      const out: string[] = []
      const walk = (d: string): void => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, e.name)
          if (e.isDirectory() && !e.isSymbolicLink()) walk(p)
          else out.push(relative(root, p).replaceAll('\\', '/'))
        }
      }
      walk(root)
      return out.sort()
    },
  }
}
