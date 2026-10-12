// Runtime context and small filesystem helpers. Everything environment-dependent goes through
// Context so tests can run against a temporary home without touching the real one.

import { existsSync, lstatSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import type { Context } from './types.ts'
import { InstallerError } from './types.ts'

export function createContext(options: { projectDir?: string; env?: Record<string, string | undefined>; platform?: NodeJS.Platform } = {}): Context {
  const env = options.env ?? process.env
  const home = env.RCD_INSTALL_HOME ? resolve(env.RCD_INSTALL_HOME) : homedir()
  return {
    home,
    projectDir: resolve(options.projectDir ?? process.cwd()),
    env,
    platform: options.platform ?? process.platform,
    stateDir: env.RCD_INSTALL_STATE ? resolve(env.RCD_INSTALL_STATE) : join(home, '.rack-cabling-designer'),
  }
}

/** Find an executable on PATH without spawning a shell (honors PATHEXT on Windows). */
export function which(bin: string, ctx: Context): string | undefined {
  const path = ctx.env.PATH ?? ctx.env.Path ?? ''
  const exts = ctx.platform === 'win32' ? (ctx.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean) : ['']
  for (const dir of path.split(ctx.platform === 'win32' ? ';' : delimiter)) {
    if (!dir) continue
    for (const ext of ['', ...exts]) {
      const candidate = join(dir, bin + ext)
      try {
        if (statSync(candidate).isFile()) return candidate
      } catch {
        // not here; keep looking
      }
    }
  }
  return undefined
}

export function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** True for symbolic links and Windows junctions (lstat reports both as links). */
export function isLink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

export function exists(p: string): boolean {
  return existsSync(p) || isLink(p)
}

/** Project scope needs an existing project folder: the installer never creates projects. */
export function validateProjectDir(ctx: Context): void {
  try {
    if (statSync(ctx.projectDir).isDirectory()) return
  } catch {
    throw new InstallerError(`Project folder ${ctx.projectDir} does not exist. Check the path or create the project first; the installer does not create projects.`)
  }
  throw new InstallerError(`${ctx.projectDir} is a file, not a project folder.`)
}

/** Display a path with ~ for the home directory. */
export function pretty(p: string, ctx: Context): string {
  return p.startsWith(ctx.home) ? `~${p.slice(ctx.home.length)}` : p
}
