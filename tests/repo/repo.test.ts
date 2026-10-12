// Repository-level checks: skill format, manifest freshness, hashing and separation of concerns.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeManifest, diffFiles, hashFile } from '../../installer/lib/manifest.ts'
import { checkSkill, parseSkill } from '../../installer/lib/skill-format.ts'
import { PAYLOAD, REPO } from '../helpers.ts'

const node = (args: string[]): { status: number | null; out: string } => {
  const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}

test('the skill passes the Agent Skills lint and all its links resolve', () => {
  const r = node(['tools/lint-skill.ts'])
  assert.equal(r.status, 0, r.out)
})

test('MANIFEST.json matches the payload', () => {
  const r = node(['tools/build-manifest.ts', '--check'])
  assert.equal(r.status, 0, r.out)
})

test('skill-format: spec fields only, name rules, Claude API rules', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'rcd-fmt-')), 'my-skill')
  mkdirSync(dir)
  const write = (fm: string): void => writeFileSync(join(dir, 'SKILL.md'), `---\n${fm}\n---\n# Body\n`)
  write('name: my-skill\ndescription: Does things. Use when needed.\nmetadata:\n  version: "1.0.0"')
  assert.deepEqual(checkSkill(dir).issues, [])
  write('name: my-skill\ndescription: x\nargument-hint: "[file]"')
  assert.match(checkSkill(dir).issues[0].message, /argument-hint/)
  write('name: other\ndescription: x')
  assert.ok(checkSkill(dir).issues.some((i) => i.message.includes('must match the folder')))
  write(`name: my-skill\ndescription: ${'a'.repeat(1025)}`)
  assert.ok(checkSkill(dir).issues.some((i) => i.message.includes('1025')))
  assert.ok(checkSkill(dir, 'claude-helper').issues.some((i) => i.message.includes('"claude"')) === false) // name is my-skill
  write('name: claude-helper\ndescription: x')
  assert.ok(checkSkill(dir, 'claude-helper').issues.some((i) => i.message.includes('claude')))
  assert.throws(() => parseSkill('no frontmatter'))
  assert.throws(() => parseSkill('---\ndescription: >\n  folded\n---\n'))
})

test('manifest hashing ignores CRLF vs LF and detects changes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rcd-man-'))
  writeFileSync(join(dir, 'a.md'), 'line1\nline2\n')
  const lf = hashFile(join(dir, 'a.md'))
  writeFileSync(join(dir, 'a.md'), 'line1\r\nline2\r\n')
  assert.equal(hashFile(join(dir, 'a.md')), lf)
  const m = computeManifest(dir, 'x', '1.0.0')
  writeFileSync(join(dir, 'b.md'), 'new')
  writeFileSync(join(dir, 'a.md'), 'changed')
  const d = diffFiles(dir, m.files)
  assert.deepEqual([d.modified, d.extra, d.missing], [['a.md'], ['b.md'], []])
})

test('domain rules live only in the skill core (no per-platform copies)', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
  for (const f of [...walk(join(REPO, 'installer')), ...walk(join(REPO, 'tools'))]) {
    assert.ok(!/RCD-[A-Z]+-/.test(readFileSync(f, 'utf8')), `${f} contains a domain rule code`)
  }
  const ruleFiles = readdirSync(join(PAYLOAD, 'scripts', 'lib', 'rules'))
  assert.ok(ruleFiles.length >= 6)
})
