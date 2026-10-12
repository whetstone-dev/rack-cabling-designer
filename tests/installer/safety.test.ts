// Safety requirements: no execution of unverified code, no network, no shell, no admin paths,
// bounded custom targets, uninstall never deletes user projects, clear errors, logging.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateCustomRoot } from '../../installer/adapters/custom.ts'
import { REPO, sandbox } from '../helpers.ts'

const NAME = 'rack-cabling-designer'

/** A fake toolkit that leaves a marker file if anyone executes it. */
function trap(dir: string, marker: string): void {
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${NAME}\ndescription: impostor\n---\n`)
  writeFileSync(join(dir, 'scripts', 'rackcab.ts'), `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(marker)}, 'executed')\n`)
}

test('verify never executes a foreign copy', () => {
  const s = sandbox()
  const marker = join(s.root, 'EXECUTED')
  trap(join(s.home, '.agents', 'skills', NAME), marker)
  const r = s.run(['--verify', '--agents', 'codex'])
  assert.ok(!existsSync(marker), 'foreign code was executed')
  assert.match(r.out, /never executed/)
})

test('verify never executes our copy after its code was modified', () => {
  const s = sandbox()
  assert.equal(s.run(['--agents', 'claude-code', '--yes', '--no-selftest']).status, 0)
  const marker = join(s.root, 'EXECUTED')
  appendFileSync(join(s.home, '.claude', 'skills', NAME, 'scripts', 'rackcab.ts'), `\nimport { writeFileSync as w } from 'node:fs'; w(${JSON.stringify(marker)}, 'x')\n`)
  const r = s.run(['--verify', '--agents', 'claude-code'])
  assert.equal(r.status, 1)
  assert.match(r.out, /modified scripts\/rackcab\.ts/)
  assert.ok(!existsSync(marker), 'tampered code was executed')
})

test('installer source: no network, no shell, child processes only for the verified self-test', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
  for (const f of walk(join(REPO, 'installer'))) {
    const src = readFileSync(f, 'utf8')
    assert.ok(!/node:(https?|net|dgram|tls)|\bfetch\(|XMLHttpRequest|WebSocket/.test(src), `${f} uses the network`)
    assert.ok(!/\b(sudo|runas|Start-Process)\b/.test(src.replace(/\/\/.*$/gm, '')), `${f} asks for elevation`)
    assert.ok(!/shell:\s*true|(?<!\.)\bexec(Sync)?\(|execFile/.test(src), `${f} runs shell commands`)
    if (/node:child_process/.test(src)) {
      assert.match(f, /verify\.ts$/, `${f} spawns processes`)
      assert.match(src, /spawnSync\(process\.execPath, \[join\(dir, 'scripts', 'rackcab\.ts'\), 'selftest'\]/)
    }
  }
})

test('custom targets must stay inside home or project and outside the checkout', () => {
  const s = sandbox()
  mkdirSync(join(s.home, '.myapp'))
  const ctx = s.ctx()
  assert.equal(validateCustomRoot(join(s.home, '.myapp', 'skills'), ctx, [REPO]), join(s.home, '.myapp', 'skills'))
  assert.throws(() => validateCustomRoot(s.root, ctx, [REPO]), /inside your home/)
  assert.throws(() => validateCustomRoot(s.home, ctx, [REPO]), /inside your home/)
  assert.throws(() => validateCustomRoot(process.platform === 'win32' ? 'C:\\Windows\\skills' : '/etc/skills', ctx, [REPO]), /system locations/)
  assert.throws(() => validateCustomRoot(join(s.state, 'x'), ctx, [REPO]), /inside/)
})

test('custom app: install, verify (files only) and uninstall', () => {
  const s = sandbox()
  mkdirSync(join(s.home, '.myapp'))
  const root = join(s.home, '.myapp', 'skills')
  const r = s.run(['--target', root, '--yes'])
  assert.equal(r.status, 0, r.out)
  assert.ok(existsSync(join(root, NAME, 'SKILL.md')))
  const v = s.run(['--verify', '--target', root])
  assert.equal(v.status, 0, v.out)
  assert.match(v.out, /app loading — cannot be verified automatically/)
  assert.equal(s.run(['--uninstall', '--target', root, '--yes']).status, 0)
  assert.ok(!existsSync(join(root, NAME)))
  assert.ok(existsSync(root), 'the app folder itself is kept')
})

test('uninstall in project scope keeps the project, its files and other skills', () => {
  const s = sandbox()
  writeFileSync(join(s.project, 'design.rack.json'), '{}')
  mkdirSync(join(s.project, '.claude', 'skills', 'other-skill'), { recursive: true })
  writeFileSync(join(s.project, '.claude', 'skills', 'other-skill', 'SKILL.md'), 'mine')
  assert.equal(s.run(['--agents', 'claude-code', '--scope', 'project', '--yes', '--no-selftest']).status, 0)
  assert.equal(s.run(['--uninstall', '--agents', 'claude-code', '--scope', 'project', '--yes']).status, 0)
  assert.ok(!existsSync(join(s.project, '.claude', 'skills', NAME)))
  assert.equal(readFileSync(join(s.project, 'design.rack.json'), 'utf8'), '{}')
  assert.ok(existsSync(join(s.project, '.claude', 'skills', 'other-skill', 'SKILL.md')))
})

test('errors: a file where the skills folder should be fails clearly and writes nothing there', () => {
  const s = sandbox()
  mkdirSync(join(s.home, '.claude'), { recursive: true })
  writeFileSync(join(s.home, '.claude', 'skills'), 'not a folder')
  const r = s.run(['--agents', 'claude-code', '--yes', '--no-selftest'])
  assert.equal(r.status, 1)
  assert.match(r.out, /file where a folder was expected|not a directory|ENOTDIR|EEXIST/i)
  assert.equal(readFileSync(join(s.home, '.claude', 'skills'), 'utf8'), 'not a folder')
})

test('simulation writes nothing (no state, no log); real runs are logged as JSON lines', () => {
  const s = sandbox()
  const dry = s.run(['--agents', 'all', '--dry-run', '--show-files'])
  assert.equal(dry.status, 0, dry.out)
  assert.match(dry.out, /Operations:/)
  assert.match(dry.out, /stage\s+copy \d+ files/)
  assert.match(dry.out, /Files to install \(\d+ files/)
  assert.ok(!existsSync(s.state))
  assert.equal(s.run(['--agents', 'codex', '--yes', '--no-selftest']).status, 0)
  const logs = readdirSync(join(s.state, 'logs'))
  assert.equal(logs.length, 1)
  const entries = readFileSync(join(s.state, 'logs', logs[0]), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { op: string })
  assert.deepEqual(['start', 'stage', 'mkdir', 'place', 'verify', 'end'].filter((op) => entries.some((e) => e.op === op)), ['start', 'stage', 'mkdir', 'place', 'verify', 'end'])
})

test('--update touches only existing installs', () => {
  const s = sandbox()
  const none = s.run(['--update', '--agents', 'all', '--yes'])
  assert.equal(none.status, 0)
  assert.match(none.out, /Nothing to update/)
  assert.equal(s.run(['--agents', 'codex', '--yes', '--no-selftest']).status, 0)
  const receiptFile = join(s.home, '.agents', 'skills', NAME, '.rcd-install.json')
  const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'))
  writeFileSync(receiptFile, JSON.stringify({ ...receipt, version: '0.0.1' }))
  const up = s.run(['--update', '--agents', 'all', '--yes', '--no-selftest'])
  assert.equal(up.status, 0, up.out)
  assert.match(up.out, /v0\.0\.1 → v/)
  assert.ok(!existsSync(join(s.home, '.claude', 'skills', NAME)), 'update must not install new copies')
})
