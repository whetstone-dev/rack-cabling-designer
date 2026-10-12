// End-to-end installer tests: the real install.ts in a sandboxed home/project/state/PATH.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, existsSync, lstatSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PAYLOAD, sandbox } from '../helpers.ts'

const NAME = 'rack-cabling-designer'
const receipt = (dir: string): { agents: string[]; version: string } => JSON.parse(readFileSync(join(dir, '.rcd-install.json'), 'utf8'))

test('dry run shows destinations and writes nothing', () => {
  const s = sandbox()
  const before = s.files()
  const r = s.run(['--agents', 'all', '--dry-run'])
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /\.claude[\\/]skills[\\/]rack-cabling-designer/)
  assert.match(r.out, /OpenAI Codex \+ Cursor/)
  assert.deepEqual(s.files(), before)
})

test('non-interactive runs require explicit choices', () => {
  const s = sandbox()
  assert.equal(s.run([]).status, 2)
  assert.equal(s.run(['--agents', 'claude-code']).status, 2) // no --yes
  assert.equal(s.run(['--agents', 'vscode', '--yes']).status, 2)
})

test('install all, verify, idempotent rerun, nothing written outside home and state', () => {
  const s = sandbox()
  const r = s.run(['--agents', 'all', '--yes'])
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /Installed and verified/)
  const claude = join(s.home, '.claude', 'skills', NAME)
  const shared = join(s.home, '.agents', 'skills', NAME)
  assert.deepEqual(receipt(claude).agents, ['claude-code'])
  assert.deepEqual(receipt(shared).agents, ['codex', 'cursor'])
  assert.ok(existsSync(join(shared, 'agents', 'openai.yaml')))
  assert.ok(!existsSync(join(s.home, '.cursor', 'skills', NAME)))
  for (const f of s.files()) assert.ok(/^(home|state|bin|project)\//.test(f), f)
  assert.ok(s.files().every((f) => !f.startsWith('project/')))

  const v = s.run(['--verify', '--agents', 'all'])
  assert.equal(v.status, 0, v.out)
  assert.match(v.out, /rackcab selftest — selftest: PASS/)

  const again = s.run(['--agents', 'all', '--yes', '--no-selftest'])
  assert.equal(again.status, 0, again.out)
  assert.match(again.out, /up to date/)
})

test('tampering is detected; reinstall is blocked until --force, which backs up first', () => {
  const s = sandbox()
  assert.equal(s.run(['--agents', 'claude-code', '--yes', '--no-selftest']).status, 0)
  const dir = join(s.home, '.claude', 'skills', NAME)
  appendFileSync(join(dir, 'SKILL.md'), '\nInjected line\n')
  const v = s.run(['--verify', '--agents', 'claude-code', '--no-selftest'])
  assert.equal(v.status, 1)
  assert.match(v.out, /modified SKILL\.md/)
  const blocked = s.run(['--agents', 'claude-code', '--yes', '--no-selftest'])
  assert.equal(blocked.status, 1)
  assert.match(blocked.out, /local changes/)
  const forced = s.run(['--agents', 'claude-code', '--yes', '--force', '--no-selftest'])
  assert.equal(forced.status, 0, forced.out)
  assert.ok(!readFileSync(join(dir, 'SKILL.md'), 'utf8').includes('Injected line'))
  const backups = readdirSync(join(s.state, 'backups'))
  assert.equal(backups.length, 1)
})

test('foreign copies are never touched without --force', () => {
  const s = sandbox()
  const dir = join(s.home, '.agents', 'skills', NAME)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), 'user content')
  const r = s.run(['--agents', 'codex', '--yes'])
  assert.equal(r.status, 1)
  assert.match(r.out, /BLOCKED/)
  assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), 'user content')
  const u = s.run(['--uninstall', '--agents', 'codex', '--yes'])
  assert.equal(u.status, 1)
  assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), 'user content')
})

test('uninstall: shared copies are kept while used; only our files are removed', () => {
  const s = sandbox()
  assert.equal(s.run(['--agents', 'codex,cursor', '--yes', '--no-selftest']).status, 0)
  const dir = join(s.home, '.agents', 'skills', NAME)
  const kept = s.run(['--uninstall', '--agents', 'cursor', '--yes'])
  assert.equal(kept.status, 0, kept.out)
  assert.match(kept.out, /still used by OpenAI Codex/)
  assert.deepEqual(receipt(dir).agents, ['codex'])
  writeFileSync(join(dir, 'my-notes.md'), 'mine')
  const removed = s.run(['--uninstall', '--agents', 'codex', '--yes'])
  assert.equal(removed.status, 0, removed.out)
  assert.ok(!existsSync(join(dir, 'SKILL.md')))
  assert.equal(readFileSync(join(dir, 'my-notes.md'), 'utf8'), 'mine')
})

test('project scope installs inside the project only', () => {
  const s = sandbox()
  const r = s.run(['--agents', 'claude-code,cursor', '--scope', 'project', '--yes', '--no-selftest'])
  assert.equal(r.status, 0, r.out)
  assert.ok(existsSync(join(s.project, '.claude', 'skills', NAME, 'SKILL.md')))
  assert.ok(!existsSync(join(s.home, '.claude')))
})

test('development link mode links to the checkout and uninstall removes only the link', () => {
  const s = sandbox()
  const r = s.run(['--agents', 'claude-code', '--link', '--yes'])
  assert.equal(r.status, 0, r.out)
  const dir = join(s.home, '.claude', 'skills', NAME)
  assert.ok(lstatSync(dir).isSymbolicLink())
  const u = s.run(['--uninstall', '--agents', 'claude-code', '--yes'])
  assert.equal(u.status, 0, u.out)
  assert.ok(!existsSync(dir))
  assert.ok(existsSync(join(PAYLOAD, 'SKILL.md')))
})

test('--list and --json report state', () => {
  const s = sandbox()
  mkdirSync(join(s.home, '.cursor'))
  const l = JSON.parse(s.run(['--list', '--json']).out)
  assert.equal(l.assistants.find((a: { agent: string }) => a.agent === 'cursor').detected, true)
  const plan = JSON.parse(s.run(['--agents', 'all', '--dry-run', '--json']).out)
  assert.equal(plan.plan.targets.length, 2)
})
