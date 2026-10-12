// SKILL.md parsing and checks against the open Agent Skills specification
// (https://agentskills.io/specification) plus the stricter Claude API upload rules.
// Shared by tools/lint-skill.ts and the installer's verification.

import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

export const SPEC_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_BODY_LINES = 500

export interface Issue { level: 'error' | 'warning'; message: string }
export type Frontmatter = Record<string, string | Record<string, string>>

export interface ParsedSkill { frontmatter: Frontmatter; body: string }

function unquote(raw: string, line: number): string {
  const v = raw.trim()
  if (v.startsWith('"')) {
    if (!v.endsWith('"') || v.length < 2) throw new Error(`line ${line}: unterminated double-quoted string`)
    return v.slice(1, -1).replace(/\\(["\\])/g, '$1')
  }
  if (v.startsWith("'")) {
    if (!v.endsWith("'") || v.length < 2) throw new Error(`line ${line}: unterminated single-quoted string`)
    return v.slice(1, -1).replaceAll("''", "'")
  }
  if (/^[|>]/.test(v)) throw new Error(`line ${line}: block scalars (| or >) are not supported; use a single line`)
  return v
}

/** Parse the YAML subset used by skill frontmatter: scalars and one level of nested string maps. */
export function parseSkill(text: string): ParsedSkill {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!src.startsWith('---\n')) throw new Error('SKILL.md must start with a "---" frontmatter block')
  const end = src.indexOf('\n---', 4)
  if (end < 0) throw new Error('frontmatter is not closed with "---"')
  const lines = src.slice(4, end).split('\n')
  const body = src.slice(end + 4).replace(/^[^\n]*\n/, '')
  const fm: Frontmatter = {}
  let current: Record<string, string> | undefined
  lines.forEach((line, i) => {
    const n = i + 2
    if (!line.trim() || line.trim().startsWith('#')) return
    const nested = /^\s+([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line)
    if (nested) {
      if (!current) throw new Error(`line ${n}: unexpected indentation`)
      current[nested[1]] = unquote(nested[2], n)
      return
    }
    const top = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!top) throw new Error(`line ${n}: cannot parse "${line.trim()}"`)
    if (Object.hasOwn(fm, top[1])) throw new Error(`line ${n}: duplicate key "${top[1]}"`)
    if (top[2].trim() === '') {
      current = {}
      fm[top[1]] = current
    } else {
      current = undefined
      fm[top[1]] = unquote(top[2], n)
    }
  })
  return { frontmatter: fm, body }
}

/** Check a skill folder. `dirName` defaults to the folder's base name. */
export function checkSkill(skillDir: string, dirName = basename(skillDir)): { parsed?: ParsedSkill; issues: Issue[] } {
  const issues: Issue[] = []
  let parsed: ParsedSkill
  try {
    parsed = parseSkill(readFileSync(join(skillDir, 'SKILL.md'), 'utf8'))
  } catch (e) {
    return { issues: [{ level: 'error', message: `SKILL.md: ${(e as Error).message}` }] }
  }
  const fm = parsed.frontmatter
  for (const k of Object.keys(fm)) {
    if (!SPEC_FIELDS.includes(k)) issues.push({ level: 'error', message: `frontmatter field "${k}" is not in the Agent Skills spec (claude.ai/API uploads and skills-ref reject it)` })
  }
  const name = fm.name
  if (typeof name !== 'string' || !name) issues.push({ level: 'error', message: 'missing "name"' })
  else {
    if (name.length > 64) issues.push({ level: 'error', message: '"name" is longer than 64 characters' })
    if (!NAME_RE.test(name)) issues.push({ level: 'error', message: '"name" must be lowercase letters, digits and single hyphens' })
    if (name !== dirName) issues.push({ level: 'error', message: `"name" (${name}) must match the folder name (${dirName})` })
    if (/claude|anthropic/.test(name)) issues.push({ level: 'error', message: '"name" must not contain "claude" or "anthropic" (Claude API rule)' })
  }
  const desc = fm.description
  if (typeof desc !== 'string' || !desc.trim()) issues.push({ level: 'error', message: 'missing "description"' })
  else {
    if (desc.length > 1024) issues.push({ level: 'error', message: `"description" is ${desc.length} characters (max 1024)` })
    if (/<[^>]+>/.test(desc)) issues.push({ level: 'error', message: '"description" must not contain XML/HTML tags (Claude API rule)' })
  }
  if (fm.compatibility !== undefined && (typeof fm.compatibility !== 'string' || fm.compatibility.length > 500)) issues.push({ level: 'error', message: '"compatibility" must be a string of at most 500 characters' })
  if (fm.metadata !== undefined && typeof fm.metadata !== 'object') issues.push({ level: 'error', message: '"metadata" must be a map of strings' })
  if (fm.license !== undefined && typeof fm.license !== 'string') issues.push({ level: 'error', message: '"license" must be a string' })
  const bodyLines = parsed.body.split('\n').length
  if (bodyLines > MAX_BODY_LINES) issues.push({ level: 'warning', message: `SKILL.md body has ${bodyLines} lines; the spec recommends under ${MAX_BODY_LINES}` })
  return { parsed, issues }
}

export function skillVersion(parsed: ParsedSkill | undefined): string | undefined {
  const meta = parsed?.frontmatter.metadata
  return typeof meta === 'object' ? meta.version : undefined
}
