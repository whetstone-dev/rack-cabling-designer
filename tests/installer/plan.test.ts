// Planning tests: sharing of compatible folders, visibility, and decisions about existing copies.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { computePlan } from '../../installer/lib/plan.ts'
import { writeReceipt } from '../../installer/lib/receipt.ts'
import { compareVersions } from '../../installer/lib/receipt.ts'
import { sandbox } from '../helpers.ts'

const NAME = 'rack-cabling-designer'

test('all assistants: Codex and Cursor share ~/.agents/skills, Claude gets its own copy', () => {
  const s = sandbox()
  const plan = computePlan({ scope: 'user', agents: ['claude-code', 'codex', 'cursor'], version: '0.1.0' }, s.ctx())
  assert.equal(plan.targets.length, 2)
  assert.equal(plan.serves.cursor, join(s.home, '.agents', 'skills', NAME))
  assert.equal(plan.serves['claude-code'], join(s.home, '.claude', 'skills', NAME))
  assert.ok(plan.warnings.some((w) => w.startsWith('Cursor will see 2 copies')))
})

test('Claude + Cursor: Cursor reuses the Claude copy; Cursor alone uses ~/.cursor/skills', () => {
  const s = sandbox()
  const ctx = s.ctx()
  const both = computePlan({ scope: 'user', agents: ['cursor', 'claude-code'], version: '0.1.0' }, ctx)
  assert.equal(both.targets.length, 1)
  assert.deepEqual(both.targets[0].agents, ['claude-code', 'cursor'])
  assert.deepEqual(both.warnings, [])
  const alone = computePlan({ scope: 'user', agents: ['cursor'], version: '0.1.0' }, ctx)
  assert.equal(alone.targets[0].dir, join(s.home, '.cursor', 'skills', NAME))
  const vis = alone.visibility.find((v) => v.agent === 'codex')!
  assert.deepEqual(vis.dirs, [])
})

test('--no-share writes one copy per native folder; project scope stays inside the project', () => {
  const s = sandbox()
  const plan = computePlan({ scope: 'project', agents: ['claude-code', 'codex', 'cursor'], version: '0.1.0', share: false }, s.ctx())
  assert.deepEqual(plan.targets.map((t) => t.root), [join(s.project, '.claude', 'skills'), join(s.project, '.agents', 'skills'), join(s.project, '.cursor', 'skills')])
  assert.ok(plan.warnings.some((w) => w.startsWith('Cursor will see 3 copies')))
})

test('existing copies: foreign is blocked (or replaced with --force), npx skills is recognized', () => {
  const s = sandbox()
  const dir = join(s.home, '.claude', 'skills', NAME)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), '---\nname: rack-cabling-designer\n---\n')
  let plan = computePlan({ scope: 'user', agents: ['claude-code'], version: '0.1.0' }, s.ctx())
  assert.equal(plan.targets[0].action, 'blocked')
  mkdirSync(join(s.home, '.agents'), { recursive: true })
  writeFileSync(join(s.home, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: { [NAME]: {} } }))
  plan = computePlan({ scope: 'user', agents: ['claude-code'], version: '0.1.0' }, s.ctx())
  assert.match(plan.targets[0].reason!, /npx skills/)
  plan = computePlan({ scope: 'user', agents: ['claude-code'], version: '0.1.0', force: true }, s.ctx())
  assert.equal(plan.targets[0].action, 'replace')
})

test('our copies: update, unchanged, modified and downgrade decisions', () => {
  const s = sandbox()
  const dir = join(s.home, '.claude', 'skills', NAME)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'a.txt'), 'x')
  const hash = '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881' // sha256("x")
  writeReceipt(dir, { receiptVersion: 1, name: NAME, version: '0.1.0', installedAt: '', scope: 'user', agents: ['claude-code'], source: '', files: { 'a.txt': hash } })
  const plan = (version: string, force = false): string => computePlan({ scope: 'user', agents: ['claude-code'], version, force }, s.ctx()).targets[0].action
  assert.equal(plan('0.2.0'), 'update')
  assert.equal(plan('0.1.0'), 'unchanged')
  assert.equal(plan('0.0.9'), 'blocked')
  assert.equal(plan('0.0.9', true), 'reinstall')
  writeFileSync(join(dir, 'a.txt'), 'changed')
  assert.equal(plan('0.2.0'), 'blocked')
  assert.equal(plan('0.2.0', true), 'update')
})

test('semver comparison', () => {
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1)
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.1'), -1)
})
