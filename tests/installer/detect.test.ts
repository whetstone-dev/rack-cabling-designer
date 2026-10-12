// Detection tests: platform status with limitations, existing copies and who sees them.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectPlatforms, findCopies, inspectExisting } from '../../installer/lib/detect.ts'
import { sandbox } from '../helpers.ts'

const NAME = 'rack-cabling-designer'

test('every platform reports detection evidence and its limitations', () => {
  const s = sandbox()
  const status = detectPlatforms(s.ctx())
  assert.deepEqual(status.map((x) => x.id), ['claude-code', 'codex', 'cursor'])
  for (const x of status) {
    assert.equal(x.present, false)
    assert.ok(x.limitations.length > 0, `${x.id} must explain what it cannot detect/verify`)
  }
  const ctx = s.ctx()
  ctx.customRoot = join(s.home, '.app', 'skills')
  const withCustom = detectPlatforms(ctx)
  assert.equal(withCustom.at(-1)!.id, 'custom')
  assert.deepEqual(withCustom.at(-1)!.evidence, ['manual selection'])
})

test('existing copies are classified and attributed to every platform that scans them', () => {
  const s = sandbox()
  const dir = join(s.home, '.claude', 'skills', NAME)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), 'x')
  const copies = findCopies('user', ['claude-code', 'codex', 'cursor'], s.ctx())
  assert.equal(copies.length, 1)
  assert.deepEqual(copies[0].seenBy, ['claude-code', 'cursor'])
  assert.equal(copies[0].existing.kind, 'foreign')
  assert.equal(inspectExisting(join(s.home, 'nothing'), s.ctx()).kind, 'none')
})
