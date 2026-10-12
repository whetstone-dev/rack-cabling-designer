// "Other compatible app" adapter: any client that implements the open Agent Skills format
// (https://agentskills.io) and reads skills from a folder. The user picks the folder; the
// installer cannot detect the app nor verify that it loads the skill, and says so.

import { statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { Adapter, CheckResult, Context, Scope } from '../lib/types.ts'
import { InstallerError } from '../lib/types.ts'

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

function inside(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Validate a manually chosen skills folder. It must be inside the home or project folder
 * (so no administrator rights are ever needed), not the home/project itself, not inside the
 * installer's own checkout or state folder, and not an existing file.
 */
export function validateCustomRoot(input: string, ctx: Context, forbidden: string[]): string {
  if (!input.trim()) throw new InstallerError('The custom skills folder is empty.')
  const root = resolve(ctx.projectDir, input.trim())
  if (!inside(root, ctx.home) && !inside(root, ctx.projectDir)) {
    throw new InstallerError(`Custom folder ${root} must be inside your home (${ctx.home}) or the project (${ctx.projectDir}); the installer never writes to system locations.`)
  }
  for (const f of [...forbidden, ctx.stateDir]) {
    if (root === resolve(f) || inside(root, resolve(f))) throw new InstallerError(`Custom folder ${root} is inside ${f}; choose the app's skills folder instead.`)
  }
  try {
    if (!statSync(root).isDirectory()) throw new InstallerError(`${root} exists and is not a folder.`)
  } catch (e) {
    if (e instanceof InstallerError) throw e
    // The skills folder itself may be created, but its parent (the app's folder) must exist:
    // a typo must not create stray folders in the user's home.
    if (!isDirectory(dirname(root))) throw new InstallerError(`${dirname(root)} does not exist. Check the path (typo?) or start the app once so it creates its folder; the installer only creates the final skills folder.`)
  }
  return root
}

function root(ctx: Context): string {
  if (!ctx.customRoot) throw new InstallerError('No custom skills folder was given (use --target <folder>).')
  return ctx.customRoot
}

export const custom: Adapter = {
  id: 'custom',
  displayName: 'Other compatible app',
  docs: ['https://agentskills.io/specification'],
  limitations: [
    'The app cannot be detected automatically; you choose its skills folder.',
    'Only files, format and the toolkit self-test can be verified, not that the app actually loads the skill. Check it in the app.',
  ],
  installRoot(_scope: Scope, ctx: Context): string {
    return root(ctx)
  },
  scanRoots(_scope: Scope, ctx: Context): string[] {
    return [root(ctx)]
  },
  detect() {
    return { present: false, evidence: ['manual selection'] }
  },
  activation(): string {
    return 'Restart or reload the app, then confirm the skill is listed.'
  },
  invocation: 'depends on the app (usually by describing a rack/cabling task)',
  specificFiles: [],
  check(_dir: string, ctx: Context): CheckResult[] {
    const name = root(ctx).split(sep).pop() ?? ''
    return [{ name: 'app loading', status: 'warn', detail: `cannot be verified automatically${name === 'skills' ? '' : '; most apps expect a folder named "skills"'}` }]
  },
}
