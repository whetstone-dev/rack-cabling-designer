// Adapter tests: verified paths per platform and scope, compatibility roots, detection and
// platform-specific checks. Adapters must stay free of domain logic.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { claudeCode } from '../../installer/adapters/claude-code.ts'
import { codex } from '../../installer/adapters/codex.ts'
import { cursor } from '../../installer/adapters/cursor.ts'
import { ADAPTERS } from '../../installer/adapters/index.ts'
import { createContext } from '../../installer/lib/context.ts'
import { PAYLOAD, REPO, sandbox } from '../helpers.ts'

test('claude-code: ~/.claude/skills, $CLAUDE_CONFIG_DIR override, .claude/skills in projects', () => {
  const s = sandbox()
  const ctx = s.ctx()
  assert.equal(claudeCode.installRoot('user', ctx), join(s.home, '.claude', 'skills'))
  assert.equal(claudeCode.installRoot('project', ctx), join(s.project, '.claude', 'skills'))
  const custom = createContext({ projectDir: s.project, env: { ...s.env, CLAUDE_CONFIG_DIR: join(s.root, 'cfg') } })
  assert.equal(claudeCode.installRoot('user', custom), join(s.root, 'cfg', 'skills'))
  assert.deepEqual(claudeCode.scanRoots('user', ctx), [claudeCode.installRoot('user', ctx)])
})

test('codex: ~/.agents/skills native, deprecated $CODEX_HOME/skills still scanned', () => {
  const s = sandbox()
  const ctx = s.ctx()
  assert.equal(codex.installRoot('user', ctx), join(s.home, '.agents', 'skills'))
  assert.equal(codex.installRoot('project', ctx), join(s.project, '.agents', 'skills'))
  assert.ok(codex.scanRoots('user', ctx).includes(join(s.home, '.codex', 'skills')))
  const custom = createContext({ projectDir: s.project, env: { ...s.env, CODEX_HOME: join(s.root, 'ch') } })
  assert.ok(codex.scanRoots('user', custom).includes(join(s.root, 'ch', 'skills')))
  assert.ok(codex.scanRoots('project', ctx).includes(join(s.project, '.codex', 'skills')))
})

test('cursor: native .cursor/skills, also scans .agents, .claude and .codex', () => {
  const s = sandbox()
  const ctx = s.ctx()
  assert.equal(cursor.installRoot('user', ctx), join(s.home, '.cursor', 'skills'))
  assert.deepEqual(cursor.scanRoots('project', ctx), ['.cursor', '.agents', '.claude', '.codex'].map((d) => join(s.project, d, 'skills')))
})

test('every adapter scans its own install root first', () => {
  const ctx = sandbox().ctx()
  for (const a of ADAPTERS) for (const scope of ['user', 'project'] as const) assert.equal(a.scanRoots(scope, ctx)[0], a.installRoot(scope, ctx), `${a.id} ${scope}`)
})

test('detection: config folders and binaries on PATH', () => {
  const s = sandbox()
  for (const a of ADAPTERS) assert.equal(a.detect(s.ctx()).present, false, a.id)
  mkdirSync(join(s.home, '.codex'))
  s.fakeBinary('claude')
  s.fakeBinary('cursor-agent')
  const ctx = s.ctx()
  assert.deepEqual(claudeCode.detect(ctx).evidence, ['claude on PATH'])
  assert.deepEqual(codex.detect(ctx).evidence, ['~/.codex exists'])
  assert.deepEqual(cursor.detect(ctx).evidence, ['cursor-agent on PATH'])
})

test('platform checks on the real payload', () => {
  const s = sandbox()
  const ctx = s.ctx()
  assert.equal(claudeCode.check(PAYLOAD, ctx)[0].status, 'pass')
  assert.equal(codex.check(PAYLOAD, ctx)[0].status, 'pass') // agents/openai.yaml
  mkdirSync(join(s.home, '.codex', 'skills', 'rack-cabling-designer'), { recursive: true })
  assert.ok(codex.check(PAYLOAD, ctx).some((c) => c.name === 'Codex legacy location' && c.status === 'warn'))
  assert.equal(cursor.check(PAYLOAD, ctx)[0].status, 'warn') // version not readable from disk
})

test('adapters contain no domain logic: no imports from the skill, no RCD rules', () => {
  const dir = join(REPO, 'installer', 'adapters')
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), 'utf8')
    assert.ok(!/from ['"][^'"]*skills\//.test(src), `${f} imports skill code`)
    assert.ok(!/RCD-[A-Z]/.test(src), `${f} contains rule codes`)
  }
})
