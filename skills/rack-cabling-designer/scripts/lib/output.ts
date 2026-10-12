// Safe file output: generated files stay inside the chosen directory and never write through links.

import { lstatSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { UserError } from './model.ts'

/** Resolve a child path inside `directory`; refuse escapes and existing symbolic links. */
export function safeOutputPath(directory: string, ...parts: string[]): string {
  const root = resolve(directory)
  const target = resolve(root, ...parts)
  const rel = relative(root, target)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new UserError('Generated output path must stay inside the destination directory.')
  let current = root
  for (const part of ['', ...rel.split(sep)]) {
    if (part) current = join(current, part)
    try {
      if (lstatSync(current).isSymbolicLink()) throw new UserError(`Refusing to write through a symbolic link: ${current}`)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
  }
  return target
}

/** Write a UTF-8 text file with LF line endings, creating parent folders. */
export function writeText(file: string, content: string): void {
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content.replace(/\r\n/g, '\n'), 'utf8')
  } catch (e) {
    throw new UserError(`Could not write ${file}: ${(e as Error).message}`)
  }
}
