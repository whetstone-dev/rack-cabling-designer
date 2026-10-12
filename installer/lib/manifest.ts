// Payload manifest: the exact file list with SHA-256 hashes. Text files are hashed with LF line
// endings so a CRLF checkout (git autocrlf) still matches.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { InstallerError } from './types.ts'

export const MANIFEST_FILE = 'MANIFEST.json'
export const RECEIPT_FILE = '.rcd-install.json'

const TEXT_EXT = new Set(['.md', '.ts', '.json', '.yaml', '.yml', '.txt', '.csv', '.html', '.css', '.js', '.svg'])
const IGNORED = new Set([MANIFEST_FILE, RECEIPT_FILE, '.DS_Store', 'Thumbs.db', 'desktop.ini', 'node_modules'])

export interface Manifest {
  manifestVersion: 1
  name: string
  version: string
  files: Record<string, string>
}

export function hashFile(file: string): string {
  const data = readFileSync(file)
  const content = TEXT_EXT.has(extname(file).toLowerCase()) ? Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : data
  return createHash('sha256').update(content).digest('hex')
}

/** Relative POSIX paths of all payload files (skips dotfiles, build outputs and the manifest). */
export function listFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED.has(entry.name) || entry.name.startsWith('.') || entry.name.endsWith('-build')) continue
      const full = join(dir, entry.name)
      if (entry.isSymbolicLink()) throw new InstallerError(`Payload must not contain links: ${full}`)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) out.push(relative(root, full).split(sep).join('/'))
    }
  }
  walk(root)
  return out.sort()
}

export function computeManifest(root: string, name: string, version: string): Manifest {
  const files: Record<string, string> = {}
  for (const f of listFiles(root)) files[f] = hashFile(join(root, ...f.split('/')))
  return { manifestVersion: 1, name, version, files }
}

export function readManifest(root: string): Manifest {
  let m: Manifest
  try {
    m = JSON.parse(readFileSync(join(root, MANIFEST_FILE), 'utf8')) as Manifest
  } catch (e) {
    throw new InstallerError(`Cannot read ${join(root, MANIFEST_FILE)}: ${(e as Error).message}. Run "node tools/build-manifest.ts".`)
  }
  if (m.manifestVersion !== 1 || typeof m.files !== 'object') throw new InstallerError(`Unsupported manifest format in ${root}`)
  for (const f of Object.keys(m.files)) {
    if (f.startsWith('/') || f.split('/').includes('..') || f.includes('\\')) throw new InstallerError(`Manifest entry escapes the skill folder: ${f}`)
  }
  return m
}

export interface FileDiff { missing: string[]; modified: string[]; extra: string[] }

/** Compare a folder against expected hashes. */
export function diffFiles(root: string, expected: Record<string, string>): FileDiff {
  const actual = new Set(listFiles(root))
  const missing: string[] = []
  const modified: string[] = []
  for (const [f, hash] of Object.entries(expected)) {
    if (!actual.has(f)) missing.push(f)
    else if (hashFile(join(root, ...f.split('/'))) !== hash) modified.push(f)
    actual.delete(f)
  }
  return { missing, modified, extra: [...actual] }
}

export function isClean(d: FileDiff): boolean {
  return d.missing.length === 0 && d.modified.length === 0
}

/** Files that an install copies, with sizes, for the review step. */
export function payloadFiles(root: string, manifest: Manifest): { path: string; bytes: number }[] {
  return Object.keys(manifest.files).map((f) => {
    let bytes = 0
    try {
      bytes = statSync(join(root, ...f.split('/'))).size
    } catch {
      bytes = 0
    }
    return { path: f, bytes }
  })
}
