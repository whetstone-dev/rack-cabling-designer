#!/usr/bin/env node
// Level-2 audit against the REAL assistant CLI (headless). Four cases per platform, each in a fresh
// temporary project, with evidence taken from the CLI's own event stream:
//   control   — skill NOT installed: the assistant must not list it (proves the next cases are not
//               served by some other copy)
//   discovery — installed in project scope: the assistant lists it among its skills
//   implicit  — task described without naming the skill: expect the toolkit's PASS line AND
//               evidence that the skill was loaded (Claude: Skill tool call; Codex: SKILL.md read)
//   explicit  — /rack-cabling-designer (Claude) or $rack-cabling-designer (Codex)
// Uses the caller's own CLI login; never run in CI.
//
//   node tests/platform-smoke/smoke.ts --agent claude-code|codex|cursor [--model <id>] [--case <name>] [--json]

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContext, which } from '../../installer/lib/context.ts'
import { INSTALLER, PAYLOAD } from '../helpers.ts'

type Agent = 'claude-code' | 'codex' | 'cursor'
interface CaseResult { case: string; status: 'PASS' | 'FAIL' | 'INCONCLUSIVE'; evidence: string[]; answer: string }

/** Environment problems that say nothing about the skill: account limits, auth, sandbox start-up. */
const ENVIRONMENT_ERRORS = /usage limit|rate limit|not supported when using Codex|not logged in|authentication|windows sandbox: runner failed|CreateProcessAsUserW failed/i

const NAME = 'rack-cabling-designer'
const PASS_LINE = /PASS: 0 error\(s\), 0 warning\(s\)/
const LIST = 'List the names of all skills available to you in this session, one per line, names only. Do not use any tool.'
const IMPLICIT = 'Check whether the rack design in small-office.rack.json (current folder) is valid. Do not modify any file. Reply with only the final summary line of the check.'
const EXPLICIT: Record<Agent, string> = {
  'claude-code': `/${NAME} validate small-office.rack.json with the toolkit and reply with only its final summary line`,
  codex: `$${NAME} validate small-office.rack.json with the toolkit and reply with only its final summary line`,
  cursor: `/${NAME} validate small-office.rack.json with the toolkit and reply with only its final summary line`,
}

function flag(name: string): string | undefined {
  return process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined
}

function project(install: boolean, agent: Agent): string {
  const dir = mkdtempSync(join(tmpdir(), `rcd-smoke-${agent}-`))
  copyFileSync(join(PAYLOAD, 'examples', 'small-office.rack.json'), join(dir, 'small-office.rack.json'))
  if (install) {
    const r = spawnSync(process.execPath, [INSTALLER, '--agents', agent, '--scope', 'project', '--project', dir, '--yes', '--no-share'], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`install failed: ${r.stdout}${r.stderr}`)
  }
  return dir
}

/** Run the CLI; returns the final answer and the raw event stream. Windows needs a shell for .cmd shims. */
function runCli(agent: Agent, cwd: string, prompt: string, model?: string): { answer: string; events: string } {
  const env = { ...process.env }
  delete env.CLAUDECODE // allow launching Claude Code from inside a Claude Code session
  const opts = { cwd, env, encoding: 'utf8' as const, timeout: 600_000, maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' }
  const q = (s: string): string => JSON.stringify(s) // constant prompts only; quoted for the .cmd shim
  const m = model ? ['--model', model] : []
  if (agent === 'claude-code') {
    const r = spawnSync('claude', ['-p', q(prompt), ...m, '--output-format', 'stream-json', '--verbose', '--allowedTools', q('Bash(node:*)'), 'Read', 'Glob', 'Grep', 'Skill'], opts)
    const events = `${r.stdout ?? ''}`
    const result = events.split('\n').map((l) => { try { return JSON.parse(l) } catch { return undefined } }).find((e) => e?.type === 'result')
    return { answer: String(result?.result ?? r.stderr ?? ''), events }
  }
  if (agent === 'codex') {
    const last = join(cwd, '.codex-last.txt')
    const r = spawnSync('codex', ['exec', ...m, '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write', '--output-last-message', q(last), q(prompt)], opts)
    const errors = [...`${r.stdout ?? ''}`.matchAll(/"message":"([^"]*)"/g)].map((x) => x[1]).join(' | ')
    return { answer: existsSync(last) ? readFileSync(last, 'utf8') : `${errors} ${r.stderr ?? ''}`, events: `${r.stdout ?? ''}` }
  }
  const bin = which('cursor-agent', createContext()) ? 'cursor-agent' : 'agent'
  const r = spawnSync(bin, ['-p', q(prompt), ...m, '--output-format', 'stream-json'], opts)
  return { answer: `${r.stdout ?? ''}`, events: `${r.stdout ?? ''}` }
}

function skillEvidence(agent: Agent, events: string): string[] {
  const ev: string[] = []
  if (agent === 'claude-code') {
    for (const line of events.split('\n')) {
      let e: { type?: string; message?: { content?: { type?: string; name?: string; input?: Record<string, unknown> }[] } }
      try { e = JSON.parse(line) } catch { continue }
      for (const c of e.message?.content ?? []) {
        if (c.type === 'tool_use' && c.name === 'Skill') ev.push(`Skill tool call: ${JSON.stringify(c.input)}`)
        if (c.type === 'tool_use' && c.name === 'Bash' && String(c.input?.command ?? '').includes('rackcab.ts')) ev.push(`Bash: ${String(c.input?.command).slice(0, 160)}`)
      }
    }
    if (/"subtype":"init"[^\n]*"rack-cabling-designer"/.test(events)) ev.push('init event lists rack-cabling-designer among skills/commands')
  } else {
    for (const m of events.matchAll(/"command":"((?:[^"\\]|\\.)*)"/g)) {
      const cmd = m[1]
      if (/rack-cabling-designer[\\/]+SKILL\.md/.test(cmd)) ev.push(`read SKILL.md: ${cmd.slice(0, 160)}`)
      if (cmd.includes('rackcab.ts')) ev.push(`ran toolkit: ${cmd.slice(0, 160)}`)
    }
  }
  return [...new Set(ev)]
}

function main(): number {
  const agent = flag('--agent') as Agent | undefined
  if (!agent || !['claude-code', 'codex', 'cursor'].includes(agent)) {
    console.error('Usage: node tests/platform-smoke/smoke.ts --agent claude-code|codex|cursor [--model <id>] [--case control|discovery|implicit|explicit] [--json]')
    return 2
  }
  const ctx = createContext()
  const bin = agent === 'claude-code' ? 'claude' : agent === 'codex' ? 'codex' : (which('cursor-agent', ctx) ? 'cursor-agent' : 'agent')
  if (!which(bin, ctx)) {
    console.log(`SKIPPED (${agent}): the "${bin}" CLI is not on PATH, so nothing can be claimed about activation. Use the manual checklist in docs/testing.md.`)
    return 3
  }
  const model = flag('--model')
  const only = flag('--case')
  const results: CaseResult[] = []
  const cases: [string, boolean, string, (answer: string, ev: string[]) => boolean][] = [
    ['control', false, LIST, (a, ev) => !a.includes(NAME) && ev.length === 0],
    ['discovery', true, LIST, (a, ev) => a.includes(NAME) || ev.some((e) => e.startsWith('init event'))],
    ['implicit', true, IMPLICIT, (a, ev) => PASS_LINE.test(a) && ev.length > 0],
    ['explicit', true, EXPLICIT[agent], (a, ev) => PASS_LINE.test(a) && ev.length > 0],
  ]
  for (const [name, install, prompt, check] of cases) {
    if (only && only !== name) continue
    const dir = project(install, agent)
    const { answer, events } = runCli(agent, dir, prompt, model)
    const evidence = skillEvidence(agent, events)
    const status = check(answer, evidence) ? 'PASS' : ENVIRONMENT_ERRORS.test(`${answer}
${events}`) ? 'INCONCLUSIVE' : 'FAIL'
    results.push({ case: name, status, evidence, answer: answer.trim().slice(-600) })
    console.log(`${status} ${agent} ${name}\n  answer: ${answer.trim().split('\n').slice(-12).join(' | ').slice(0, 400)}\n  evidence: ${evidence.join(' || ') || 'none'}`)
    rmSync(dir, { recursive: true, force: true })
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify({ agent, model: model ?? null, results }, null, 2))
  // 0 all pass · 1 a real failure · 3 nothing failed but something could not be concluded
  return results.some((r) => r.status === 'FAIL') ? 1 : results.some((r) => r.status === 'INCONCLUSIVE') ? 3 : 0
}

process.exitCode = main()
