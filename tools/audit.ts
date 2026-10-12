#!/usr/bin/env node
// Structural + local functional audit of every installer target.
// For each platform × scope: install into a sandboxed home/project, then check the installed copy
// (format, location, integrity, scripts/references, invocation docs) and run the toolkit FROM the
// installed location. This proves files and scripts work where each platform looks for them;
// it does NOT prove that an assistant activates the skill (see tests/platform-smoke/).
//
//   node tools/audit.ts [--json] [--out file.md]

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adapterFor } from '../installer/adapters/index.ts'
import { createContext } from '../installer/lib/context.ts'
import { SKILL_NAME } from '../installer/lib/detect.ts'
import { diffFiles, readManifest } from '../installer/lib/manifest.ts'
import { checkSkill } from '../installer/lib/skill-format.ts'
import type { AgentId, Scope } from '../installer/lib/types.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PAYLOAD = join(REPO, 'skills', SKILL_NAME)
const INSTALLER = join(REPO, 'installer', 'install.ts')

interface Check { name: string; ok: boolean; evidence: string }
interface Row { agent: AgentId; scope: Scope | 'custom'; dir: string; structural: Check[]; functional: Check[] }

function node(args: string[], opts: { cwd: string; env?: Record<string, string> }): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, args, { cwd: opts.cwd, env: opts.env ?? (process.env as Record<string, string>), encoding: 'utf8', timeout: 120_000, windowsHide: true })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const lastLine = (s: string): string => s.trim().split('\n').pop() ?? ''

function auditOne(agent: AgentId, scope: Scope | 'custom'): Row {
  const root = mkdtempSync(join(tmpdir(), `rcd-audit-${agent}-`))
  const home = join(root, 'home')
  const project = join(root, 'project')
  for (const d of [home, project, join(root, 'bin')]) mkdirSync(d, { recursive: true })
  const env = { RCD_INSTALL_HOME: home, RCD_INSTALL_STATE: join(root, 'state'), PATH: join(root, 'bin'), SystemRoot: process.env.SystemRoot ?? '', TEMP: tmpdir(), TMP: tmpdir() }
  const ctx = createContext({ projectDir: project, env })
  const args = scope === 'custom'
    ? ['--target', join(home, '.someapp', 'skills'), '--yes']
    : ['--agents', agent, '--scope', scope, '--project', project, '--yes', '--no-share']
  if (scope === 'custom') { mkdirSync(join(home, '.someapp'), { recursive: true }); ctx.customRoot = join(home, '.someapp', 'skills') }
  const inst = node([INSTALLER, ...args], { cwd: project, env })
  const s = scope === 'custom' ? 'user' : scope
  const expectedDir = join(adapterFor(agent).installRoot(s, ctx), SKILL_NAME)
  const structural: Check[] = []
  const functional: Check[] = []
  const add = (list: Check[], name: string, ok: boolean, evidence: string): void => { list.push({ name, ok, evidence }) }

  add(structural, 'installer exit 0 + verified', inst.status === 0 && /Installed and verified/.test(inst.out), `exit ${inst.status}; ${lastLine(inst.out)}`)
  const scanned = adapterFor(agent).scanRoots(s, ctx).map((r) => join(r, SKILL_NAME))
  add(structural, 'location = documented root', existsSync(join(expectedDir, 'SKILL.md')) && scanned.includes(expectedDir), relative(root, expectedDir).replaceAll('\\', '/'))

  const fmt = checkSkill(expectedDir)
  add(structural, 'format (Agent Skills spec + name = folder)', !fmt.issues.some((i) => i.level === 'error'), fmt.issues.map((i) => i.message).join('; ') || `name=${String(fmt.parsed?.frontmatter.name)}, 6 spec fields max`)

  const manifest = readManifest(PAYLOAD)
  const d = existsSync(expectedDir) ? diffFiles(expectedDir, manifest.files) : { missing: ['*'], modified: [], extra: [] }
  add(structural, 'integrity vs MANIFEST.json (SHA-256)', d.missing.length === 0 && d.modified.length === 0 && d.extra.every((x) => x === '.rcd-install.json'), `${Object.keys(manifest.files).length - d.missing.length - d.modified.length}/${Object.keys(manifest.files).length} files match; extra: ${d.extra.join(', ') || 'none'}`)

  const refs = existsSync(join(expectedDir, 'references')) ? readdirSync(join(expectedDir, 'references')).filter((f) => f.endsWith('.md')) : []
  const lint = node([join(REPO, 'tools', 'lint-skill.ts'), expectedDir], { cwd: REPO })
  add(structural, 'scripts + references present, links resolve', existsSync(join(expectedDir, 'scripts', 'rackcab.ts')) && refs.length === 9 && lint.status === 0, `rackcab.ts, ${refs.length} references; ${lastLine(lint.out)}`)

  const skillMd = existsSync(join(expectedDir, 'SKILL.md')) ? readFileSync(join(expectedDir, 'SKILL.md'), 'utf8') : ''
  const readme = readFileSync(join(REPO, 'README.md'), 'utf8')
  const invocationDocumented = agent === 'custom' || readme.includes(adapterFor(agent).displayName)
  add(structural, 'invocation documented', /scripts\/rackcab\.ts/.test(skillMd) && /directory containing this SKILL\.md/.test(skillMd) && invocationDocumented, `SKILL.md explains how to locate scripts; adapter: "${adapterFor(agent).invocation}"`)
  if (agent === 'codex') add(structural, 'Codex agents/openai.yaml', existsSync(join(expectedDir, 'agents', 'openai.yaml')), 'agents/openai.yaml present')

  // Local functional: run the toolkit from the installed location, as the assistant would.
  const cli = join(expectedDir, 'scripts', 'rackcab.ts')
  const work = join(project, 'work')
  mkdirSync(work, { recursive: true })
  const st = node([cli, 'selftest'], { cwd: work })
  add(functional, 'selftest from installed copy', st.status === 0, lastLine(st.out))
  for (const ex of ['small-office', 'datacenter-pod']) {
    const v = node([cli, 'validate', join(expectedDir, 'examples', `${ex}.rack.json`), '--strict'], { cwd: work })
    add(functional, `validate --strict ${ex}`, v.status === 0, lastLine(v.out))
  }
  const broken = node([cli, 'validate', join(expectedDir, 'examples', 'broken-rack.rack.json')], { cwd: work })
  add(functional, 'validate broken-rack fails (exit 1)', broken.status === 1, lastLine(broken.out))
  const b = node([cli, 'build', join(expectedDir, 'examples', 'datacenter-pod.rack.json'), '-o', join(work, 'out')], { cwd: work })
  const outs = existsSync(join(work, 'out')) ? readdirSync(join(work, 'out')).sort() : []
  add(functional, 'build writes 7 outputs in the user folder', b.status === 0 && outs.length === 7, outs.join(', '))
  add(functional, 'nothing written inside the installed skill', diffFiles(expectedDir, manifest.files).extra.every((x) => x === '.rcd-install.json'), 'installed copy unchanged after runs')
  const ver = node([INSTALLER, '--verify', ...(scope === 'custom' ? ['--target', ctx.customRoot!] : ['--agents', agent, '--scope', scope, '--project', project])], { cwd: project, env })
  add(functional, 'installer --verify', ver.status === 0, lastLine(ver.out))

  rmSync(root, { recursive: true, force: true })
  return { agent, scope, dir: relative(root, expectedDir).replaceAll('\\', '/'), structural, functional }
}

function main(): number {
  const rows: Row[] = []
  for (const agent of ['claude-code', 'codex', 'cursor'] as AgentId[]) for (const scope of ['user', 'project'] as Scope[]) rows.push(auditOne(agent, scope))
  rows.push(auditOne('custom', 'custom'))

  if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); return rows.every((r) => [...r.structural, ...r.functional].every((c) => c.ok)) ? 0 : 1 }
  const md: string[] = [`# Structural and local functional audit`, '', `Generated by \`node tools/audit.ts\` on ${new Date().toISOString().slice(0, 10)} · Node ${process.versions.node} · ${process.platform}`, '']
  for (const r of rows) {
    md.push(`## ${adapterFor(r.agent).displayName} · ${r.scope}`, '', `Installed at \`<sandbox>/${r.dir}\``, '', '| Layer | Check | Result | Evidence |', '|---|---|---|---|')
    for (const c of r.structural) md.push(`| structural | ${c.name} | ${c.ok ? 'PASS' : '**FAIL**'} | ${c.evidence.replaceAll('|', '\\|')} |`)
    for (const c of r.functional) md.push(`| functional (local) | ${c.name} | ${c.ok ? 'PASS' : '**FAIL**'} | ${c.evidence.replaceAll('|', '\\|')} |`)
    md.push('')
  }
  const text = md.join('\n')
  const outIdx = process.argv.indexOf('--out')
  if (outIdx > 0) writeFileSync(process.argv[outIdx + 1], text)
  console.log(text)
  const failures = rows.flatMap((r) => [...r.structural, ...r.functional].filter((c) => !c.ok).map((c) => `${r.agent}/${r.scope}: ${c.name}`))
  console.log(failures.length ? `\nAUDIT FAIL: ${failures.join('; ')}` : `\nAUDIT PASS: ${rows.length} targets`)
  return failures.length ? 1 : 0
}

process.exitCode = main()
