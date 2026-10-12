// Audit scenarios: non-existent paths, insufficient permissions (simulated everywhere, real
// chmod on POSIX), cancellation between destinations, and stale staging cleanup.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs, { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { join } from 'node:path'
import { executePlan } from '../../installer/lib/execute.ts'
import { OperationLog } from '../../installer/lib/log.ts'
import { payloadFiles, readManifest } from '../../installer/lib/manifest.ts'
import { computePlan } from '../../installer/lib/plan.ts'
import { PAYLOAD, sandbox } from '../helpers.ts'

const NAME = 'rack-cabling-designer'

test('non-existent project folder: refused, nothing created', () => {
  const s = sandbox()
  const missing = join(s.root, 'typo', 'project')
  const r = s.run(['--agents', 'claude-code', '--project', missing, '--yes'])
  assert.equal(r.status, 2)
  assert.match(r.out, /does not exist/)
  assert.ok(!existsSync(join(s.root, 'typo')))
})

test('project path that is a file: refused', () => {
  const s = sandbox()
  writeFileSync(join(s.root, 'file.txt'), 'x')
  const r = s.run(['--agents', 'codex', '--project', join(s.root, 'file.txt'), '--yes'])
  assert.equal(r.status, 2)
  assert.match(r.out, /is a file, not a project folder/)
})

test('custom folder whose parent does not exist (typo): refused, nothing created', () => {
  const s = sandbox()
  const r = s.run(['--target', join(s.home, '.typoapp', 'skills'), '--yes'])
  assert.equal(r.status, 2)
  assert.match(r.out, /does not exist\. Check the path/)
  assert.ok(!existsSync(join(s.home, '.typoapp')))
})

test('insufficient permissions (simulated EACCES): clear message, no elevation advice, nothing left behind', () => {
  const s = sandbox()
  const ctx = s.ctx()
  const manifest = readManifest(PAYLOAD)
  const plan = computePlan({ scope: 'user', agents: ['claude-code'], version: manifest.version, files: payloadFiles(PAYLOAD, manifest) }, ctx)
  const root = plan.targets[0].root
  // Inject EACCES for the skills root only; syncBuiltinESMExports makes named imports see it.
  const original = fs.mkdirSync
  fs.mkdirSync = ((p: fs.PathLike, o?: fs.MakeDirectoryOptions) => {
    if (String(p) === root) throw Object.assign(new Error(`EACCES: permission denied, mkdir '${root}'`), { code: 'EACCES', path: root })
    return original(p, o)
  }) as typeof fs.mkdirSync
  syncBuiltinESMExports()
  let results
  const log = new OperationLog(undefined, 'install')
  try {
    results = executePlan(plan, PAYLOAD, manifest, ctx, { selftest: false, log })
  } finally {
    fs.mkdirSync = original
    syncBuiltinESMExports()
  }
  assert.equal(results[0].ok, false)
  assert.match(results[0].message, /permission denied/)
  assert.match(results[0].message, /administrator rights are not needed/)
  assert.ok(!existsSync(root))
  assert.deepEqual(readdirSync(join(s.state, 'staging')), [], 'staging cleaned after failure')
  assert.ok(log.entries.some((e) => e.op === 'failed') && log.entries.some((e) => e.op === 'rollback'))
})

const posixNonRoot = process.platform !== 'win32' && process.getuid?.() !== 0
test('insufficient permissions (real chmod, POSIX only)', { skip: posixNonRoot ? false : 'needs POSIX permissions and a non-root user (runs in CI on Linux/macOS)' }, () => {
  const s = sandbox()
  const claude = join(s.home, '.claude')
  mkdirSync(claude)
  chmodSync(claude, 0o555)
  try {
    const r = s.run(['--agents', 'claude-code', '--yes', '--no-selftest'])
    assert.equal(r.status, 1)
    assert.match(r.out, /permission denied/)
    assert.ok(!existsSync(join(claude, 'skills')))
  } finally {
    chmodSync(claude, 0o755)
  }
})

test('cancellation (Ctrl+C) between destinations: current one completes, the rest are untouched', () => {
  const s = sandbox()
  const ctx = s.ctx()
  const manifest = readManifest(PAYLOAD)
  const plan = computePlan({ scope: 'user', agents: ['claude-code', 'codex'], version: manifest.version, files: payloadFiles(PAYLOAD, manifest) }, ctx)
  let calls = 0
  const results = executePlan(plan, PAYLOAD, manifest, ctx, { selftest: false, log: new OperationLog(undefined, 'install'), shouldStop: () => calls++ > 0 })
  assert.equal(results[0].ok, true)
  assert.equal(results[1].action, 'cancelled')
  assert.ok(existsSync(join(s.home, '.claude', 'skills', NAME, 'SKILL.md')))
  assert.ok(!existsSync(join(s.home, '.agents')))
})

test('stale staging from an aborted run is cleaned on the next run', () => {
  const s = sandbox()
  mkdirSync(join(s.state, 'staging', 'rcd-abandoned'), { recursive: true })
  writeFileSync(join(s.state, 'staging', 'rcd-abandoned', 'SKILL.md'), 'half copy')
  assert.equal(s.run(['--agents', 'codex', '--yes', '--no-selftest']).status, 0)
  assert.deepEqual(readdirSync(join(s.state, 'staging')), [])
  const log = readdirSync(join(s.state, 'logs'))[0]
  assert.match(readFileSync(join(s.state, 'logs', log), 'utf8'), /clean-staging/)
})
