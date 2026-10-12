// Interactive menu, driven through piped stdin: selection, manual selection of undetected
// platforms, custom folder, review, per-destination authorization and safe cancellation.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sandbox } from '../helpers.ts'

const NAME = 'rack-cabling-designer'
const lines = (...l: string[]): string => l.join('\n') + '\n'

test('detected assistant, user scope, review files and operations, then install', () => {
  const s = sandbox()
  mkdirSync(join(s.home, '.codex'))
  const r = s.run(['--no-selftest'], lines('', '1', 'f', 'o', 'y'))
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /\[detected\]\s+OpenAI Codex/)
  assert.match(r.out, /Files to install/)
  assert.match(r.out, /Operations:/)
  assert.ok(existsSync(join(s.home, '.agents', 'skills', NAME, 'SKILL.md')))
})

test('undetected platform: limitations shown, manual selection confirmed, project scope', () => {
  const s = sandbox()
  const r = s.run(['--no-selftest'], lines('3', 'y', '2', 'y'))
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /Cursor was not detected\. Limitations:/)
  assert.match(r.out, /Cursor 2\.4 or newer/)
  assert.ok(existsSync(join(s.project, '.cursor', 'skills', NAME, 'SKILL.md')))
})

test('declining the manual selection writes nothing', () => {
  const s = sandbox()
  const r = s.run([], lines('3', 'n'))
  assert.equal(r.status, 2)
  assert.ok(!existsSync(join(s.home, '.cursor')))
})

test('other compatible app through the menu', () => {
  const s = sandbox()
  mkdirSync(join(s.home, '.myapp'))
  const r = s.run(['--no-selftest'], lines('4', '~/.myapp/skills', 'y'))
  assert.equal(r.status, 0, r.out)
  assert.ok(existsSync(join(s.home, '.myapp', 'skills', NAME, 'SKILL.md')))
})

test('foreign copy: refusing authorization leaves it untouched; accepting backs it up first', () => {
  const s = sandbox()
  const dir = join(s.home, '.claude', 'skills', NAME)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), 'user content')
  const no = s.run(['--agents', 'claude-code', '--scope', 'user'], lines('n'))
  assert.equal(no.status, 1)
  assert.match(no.out, /Back it up and replace it\?/)
  assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), 'user content')

  const yes = s.run(['--agents', 'claude-code', '--scope', 'user', '--no-selftest'], lines('y', 'y'))
  assert.equal(yes.status, 0, yes.out)
  assert.notEqual(readFileSync(join(dir, 'SKILL.md'), 'utf8'), 'user content')
  const backups = readdirSync(join(s.state, 'backups'))
  const saved = join(s.state, 'backups', backups[0], readdirSync(join(s.state, 'backups', backups[0]))[0], 'SKILL.md')
  assert.equal(readFileSync(saved, 'utf8'), 'user content')
})

test('declining one destination skips only that one; the others are installed', () => {
  const s = sandbox()
  const dir = join(s.home, '.claude', 'skills', NAME)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), 'user content')
  const r = s.run(['--agents', 'claude-code,codex', '--scope', 'user', '--no-selftest'], lines('n', 'y'))
  assert.equal(r.status, 1, r.out) // partial: not everything requested was installed
  assert.match(r.out, /skipped, nothing written/)
  assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), 'user content')
  assert.ok(existsSync(join(s.home, '.agents', 'skills', NAME, '.rcd-install.json')))
})

test('end of input cancels safely', () => {
  const s = sandbox()
  const r = s.run(['--agents', 'codex', '--scope', 'user'], lines())
  assert.equal(r.status, 1)
  assert.match(r.out, /Cancelled; nothing was written/)
  assert.ok(!existsSync(join(s.home, '.agents')))
})
