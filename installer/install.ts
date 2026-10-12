#!/usr/bin/env node
// Rack & Cabling Designer installer. Node.js >= 22.18, no dependencies, no network access.
// Flow: detect → select → plan → authorize → review → execute → verify, each in its own module:
//   lib/detect.ts  lib/plan.ts  lib/execute.ts · lib/uninstall.ts  lib/verify.ts
// Run with --help.

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADAPTERS, adapterFor, isAgentId } from './adapters/index.ts'
import { validateCustomRoot } from './adapters/custom.ts'
import { createContext, pretty, validateProjectDir } from './lib/context.ts'
import { detectPlatforms, findCopies, inspectExisting, SKILL_NAME } from './lib/detect.ts'
import { elevationWarning, explainFsError } from './lib/errors.ts'
import { executePlan } from './lib/execute.ts'
import { OperationLog } from './lib/log.ts'
import { diffFiles, isClean, payloadFiles, readManifest } from './lib/manifest.ts'
import { authorizable, authorize, computePlan, refreshVisibility, type Plan } from './lib/plan.ts'
import { askAgents, askScope, Prompter, say } from './lib/prompt.ts'
import { formatChecks, formatFiles, formatOperations, formatPlan, formatResults } from './lib/report.ts'
import { checkSkill } from './lib/skill-format.ts'
import { InstallerError, type AgentId, type Context, type Scope } from './lib/types.ts'
import { uninstall } from './lib/uninstall.ts'
import { nodeVersionOk, verifyCopy } from './lib/verify.ts'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PAYLOAD = join(REPO, 'skills', SKILL_NAME)

const HELP = `Rack & Cabling Designer installer

Usage: node installer/install.ts [options]

Without options it runs interactively: detect assistants, choose one or more, choose the scope,
review destinations and files, authorize anything that would replace existing files, confirm.

Selection
  --agents <list>       claude-code, codex, cursor, custom (comma-separated) or "all" (the three known)
  --target <folder>     skills folder of another Agent Skills-compatible app (implies "custom");
                        must be inside your home or the project
  --scope user|project  user = every project (default); project = one repository
  --project <dir>       project directory for --scope project (default: current directory)

Modes
  (default)             install; already-installed copies are updated or left unchanged
  --update              update existing installs only (selected assistants, or all found)
  --verify              verify existing installs (read-only; never runs code it cannot verify)
  --uninstall           remove only files this installer installed; projects and your files are kept
  --list                detection, limitations, destinations and current state

Options
  --dry-run             simulation: show plan, operations (and files with --show-files); write nothing
  --show-files          list every file that will be installed
  --yes, -y             no prompts (non-interactive use)
  --force               authorize backup + replace of foreign, modified or newer copies
  --no-share            one copy per assistant folder instead of sharing compatible folders
  --link                development: link to this checkout instead of copying
  --no-selftest         do not run the toolkit self-test during verification
  --json                machine-readable output
  --help

Safety: no network access, no shell commands, no administrator rights. The only program run is
the installed toolkit's self-test, with this Node binary, and only for copies verified as ours.
Every real run is logged to ~/.rack-cabling-designer/logs/.

Exit codes: 0 ok · 1 blocked, failed or cancelled · 2 usage error`

type Mode = 'install' | 'update' | 'verify' | 'uninstall' | 'list' | 'help'

interface Options {
  agents?: AgentId[]
  target?: string
  scope?: Scope
  project?: string
  mode: Mode
  dryRun: boolean
  showFiles: boolean
  yes: boolean
  force: boolean
  share: boolean
  link: boolean
  selftest: boolean
  json: boolean
}

function parse(argv: string[]): Options {
  const o: Options = { mode: 'install', dryRun: false, showFiles: false, yes: false, force: false, share: true, link: false, selftest: true, json: false }
  const setMode = (m: Mode): void => {
    if (o.mode !== 'install' && o.mode !== m) throw new InstallerError(`Choose only one of --update, --verify, --uninstall, --list.`)
    o.mode = m
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = (): string => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new InstallerError(`${a} needs a value.`)
      return v
    }
    switch (a) {
      case '--agents': {
        const v = value()
        const ids = v === 'all' ? ADAPTERS.map((x) => x.id) : v.split(',').map((x) => x.trim()).filter(Boolean)
        for (const id of ids) if (!isAgentId(id)) throw new InstallerError(`Unknown assistant "${id}". Use: ${ADAPTERS.map((x) => x.id).join(', ')}, custom, or all.`)
        o.agents = [...new Set(ids)] as AgentId[]
        break
      }
      case '--target': o.target = value(); break
      case '--scope': {
        const v = value()
        if (v !== 'user' && v !== 'project') throw new InstallerError('--scope must be user or project.')
        o.scope = v
        break
      }
      case '--project': o.project = value(); break
      case '--update': setMode('update'); break
      case '--verify': setMode('verify'); break
      case '--uninstall': setMode('uninstall'); break
      case '--list': setMode('list'); break
      case '--dry-run': o.dryRun = true; break
      case '--show-files': o.showFiles = true; break
      case '--yes': case '-y': o.yes = true; break
      case '--force': o.force = true; break
      case '--no-share': o.share = false; break
      case '--link': o.link = true; break
      case '--no-selftest': o.selftest = false; break
      case '--json': o.json = true; break
      case '--help': case '-h': o.mode = 'help'; break
      default: throw new InstallerError(`Unknown option "${a}". Run --help.`)
    }
  }
  if (o.project && !o.scope) o.scope = 'project'
  if (o.target) o.agents = [...new Set([...(o.agents ?? []), 'custom' as AgentId])]
  if (o.agents?.includes('custom') && !o.target) throw new InstallerError('"custom" needs --target <skills folder of the app>.')
  return o
}

const isInteractive = (o: Options): boolean => !o.json && !o.yes && ((!!process.stdin.isTTY && !!process.stdout.isTTY) || process.env.RCD_FORCE_INTERACTIVE === '1')

function list(ctx: Context, scope: Scope, json: boolean): number {
  const rows = detectPlatforms(ctx).map((s) => {
    const a = adapterFor(s.id)
    const dir = join(a.installRoot(scope, ctx), SKILL_NAME)
    const e = inspectExisting(dir, ctx)
    const state = e.kind === 'none' ? 'not installed' : e.kind === 'ours' ? `v${e.receipt!.version}${e.diff && !isClean(e.diff) ? ' (modified)' : ''}` : e.kind === 'link' ? `link → ${e.linkTarget}` : `foreign (${e.managedBy})`
    const sees = findCopies(scope, [s.id], ctx).map((c) => c.dir)
    return { agent: s.id, name: s.name, detected: s.present, evidence: s.evidence, limitations: s.limitations, destination: dir, state, sees, invocation: a.invocation }
  })
  if (json) { console.log(JSON.stringify({ scope, payload: PAYLOAD, assistants: rows }, null, 2)); return 0 }
  say(`Scope: ${scope}${scope === 'project' ? ` (${ctx.projectDir})` : ''}\n`)
  for (const r of rows) {
    say(`${r.name} — ${r.detected ? `detected (${r.evidence.join(', ')})` : 'not detected (can be selected manually)'}`)
    say(`  destination: ${pretty(r.destination, ctx)}  [${r.state}]`)
    say(`  sees copies: ${r.sees.length ? r.sees.map((s) => pretty(s, ctx)).join(', ') : 'none'}`)
    say(`  invoke: ${r.invocation}`)
    for (const l of r.limitations) say(`  limitation: ${l}`)
    say()
  }
  say('Other Agent Skills-compatible apps: --target <their skills folder> (cannot be detected or load-verified).')
  return 0
}

function verify(ctx: Context, scope: Scope, agents: AgentId[], o: Options): number {
  const copies = findCopies(scope, agents, ctx)
  const missing = agents.filter((id) => !copies.some((c) => c.seenBy.includes(id)))
  let expected: Record<string, string> | undefined
  try { expected = readManifest(PAYLOAD).files } catch { expected = undefined }
  const report = copies.map((c) => ({ dir: c.dir, agents: c.seenBy, kind: c.existing.kind, checks: verifyCopy(c.dir, c.seenBy, ctx, { selftest: o.selftest, expected, ourLinkTarget: PAYLOAD }) }))
  const dupes = agents.filter((id) => copies.filter((c) => c.seenBy.includes(id)).length > 1)
  const failed = missing.length > 0 || report.some((r) => r.checks.some((c) => c.status === 'fail'))
  if (o.json) {
    console.log(JSON.stringify({ ok: !failed, scope, missing, duplicates: dupes, copies: report }, null, 2))
    return failed ? 1 : 0
  }
  for (const r of report) {
    say(`${r.checks.some((c) => c.status === 'fail') ? '✖' : '✔'} ${pretty(r.dir, ctx)} — ${r.kind === 'ours' ? 'installed by this installer' : r.kind}, seen by ${r.agents.map((a) => adapterFor(a).displayName).join(', ')}`)
    say(formatChecks(r.checks))
  }
  for (const id of missing) say(`✖ ${adapterFor(id).displayName}: no copy in ${scope} scope (looked in ${adapterFor(id).scanRoots(scope, ctx).map((r) => pretty(r, ctx)).join(', ')})`)
  for (const id of dupes) say(`⚠ ${adapterFor(id).displayName} sees more than one copy; keep them identical or remove extras.`)
  say('\nNot verifiable from here (confirm in each app):')
  for (const id of agents) say(`  ${adapterFor(id).displayName}: ${adapterFor(id).limitations.at(-1) ?? ''}`)
  say(failed ? '\nVerification FAILED.' : '\nVerification passed.')
  return failed ? 1 : 0
}

async function main(argv: string[]): Promise<number> {
  const o = parse(argv)
  if (o.mode === 'help') { say(HELP); return 0 }
  if (!nodeVersionOk()) console.error(`warning: Node ${process.versions.node} is older than 22.18; the skill's validators need 22.18+.`)
  const elevated = elevationWarning()
  if (elevated) console.error(`warning: ${elevated}`)

  const ctx = createContext({ projectDir: o.project })
  if (o.target) ctx.customRoot = validateCustomRoot(o.target, ctx, [REPO])
  const ask = isInteractive(o)
  const prompter = ask ? new Prompter() : undefined
  try {
    if (o.mode === 'list') return list(ctx, o.scope ?? 'user', o.json)

    if (ask && o.mode === 'install') {
      say(`Rack & Cabling Designer installer · source ${pretty(PAYLOAD, ctx)}\n`)
    }

    // Selection
    let agents = o.agents
    if (!agents) {
      if (o.mode === 'verify' || o.mode === 'update') {
        const found = detectPlatforms(ctx).filter((s) => s.present).map((s) => s.id)
        agents = found.length ? found : ADAPTERS.map((a) => a.id)
      } else if (prompter) {
        const sel = await askAgents(prompter, detectPlatforms(ctx), ctx, [REPO])
        agents = sel.agents
        if (sel.customRoot) ctx.customRoot = sel.customRoot
      } else {
        throw new InstallerError('Choose assistants with --agents (e.g. --agents claude-code,cursor or --agents all), or run in a terminal for the interactive menu.')
      }
    }
    const onlyCustom = agents.every((a) => a === 'custom')
    const scope: Scope = o.scope ?? (prompter && o.mode === 'install' && !onlyCustom ? await askScope(prompter, ctx) : 'user')
    if (prompter && o.mode === 'install' && (o.scope || onlyCustom)) say(`\nStep 2 · Scope: ${onlyCustom ? 'the folder you chose' : scope}${o.scope ? ' (from the command line)' : ''}`)

    if (scope === 'project' && !onlyCustom) validateProjectDir(ctx)
    if (o.mode === 'verify') return verify(ctx, scope, agents, o)

    if (o.mode === 'uninstall') {
      if (!o.dryRun && !o.yes) {
        if (!prompter) throw new InstallerError('Add --yes to uninstall non-interactively (or --dry-run to preview).')
        if (!(await prompter.confirm(`Remove ${SKILL_NAME} for ${agents.map((a) => adapterFor(a).displayName).join(', ')} (${scope} scope)? Only files this installer installed are removed`))) { say('Cancelled; nothing was removed.'); return 1 }
      }
      const log = new OperationLog(o.dryRun ? undefined : join(ctx.stateDir, 'logs'), 'uninstall')
      const results = uninstall(agents, scope, PAYLOAD, ctx, { force: o.force, dryRun: o.dryRun, log })
      if (o.json) console.log(JSON.stringify({ dryRun: o.dryRun, results, log: log.file ?? null }, null, 2))
      else {
        say(results.length ? formatResults(results, ctx) : 'Nothing to remove.')
        if (o.dryRun) say('\nDry run: nothing was removed.')
        else if (log.file) say(`\nLog: ${pretty(log.file, ctx)}`)
      }
      return results.every((r) => r.ok) ? 0 : 1
    }

    if (o.mode === 'update') {
      const withCopies = agents.filter((id) => findCopies(scope, [id], ctx).some((c) => c.existing.kind === 'ours' && c.existing.receipt!.agents.includes(id)))
      if (withCopies.length === 0) { say(`Nothing to update: no copy installed by this installer for ${agents.map((a) => adapterFor(a).displayName).join(', ')} in ${scope} scope.`); return 0 }
      agents = withCopies
    }

    // Payload checks
    const manifest = readManifest(PAYLOAD)
    const format = checkSkill(PAYLOAD)
    if (format.issues.some((i) => i.level === 'error')) throw new InstallerError(`The skill payload is invalid: ${format.issues.map((i) => i.message).join('; ')}`)
    const drift = diffFiles(PAYLOAD, manifest.files)
    if (!isClean(drift) && !o.link) {
      const msg = `The payload differs from MANIFEST.json (${[...drift.modified, ...drift.missing].slice(0, 3).join(', ')}). Run "node tools/build-manifest.ts" after editing the skill.`
      if (!o.force) throw new InstallerError(msg)
      console.error(`warning: ${msg} Continuing because of --force.`)
    }

    // Plan
    const plan = computePlan({ scope, agents, version: manifest.version, mode: o.link ? 'link' : 'copy', force: o.force, share: o.share, files: payloadFiles(PAYLOAD, manifest) }, ctx)
    if (!o.json) say(`\nStep 3 · Plan\n${formatPlan(plan, ctx)}\n`)

    // Authorization for anything that would replace files we did not install. Interactive: ask per
    // destination and drop the declined ones. Non-interactive: only --force authorizes.
    const skipped = prompter ? await authorizeBlocked(plan, prompter, ctx) : []
    const blocked = plan.targets.filter((t) => t.action === 'blocked')
    if (prompter && plan.targets.length === 0) { say('Nothing left to install; nothing was written.'); return 1 }

    if (o.dryRun || o.json && blocked.length) {
      if (o.json) { console.log(JSON.stringify({ dryRun: o.dryRun, blocked: blocked.length > 0, plan }, null, 2)); return blocked.length ? 1 : 0 }
      say(formatOperations(plan, ctx))
      if (o.showFiles) say(`\n${formatFiles(plan)}`)
      say(`\nDry run (simulation): nothing was written${blocked.length ? `; ${blocked.length} destination(s) would be skipped as BLOCKED` : ''}.`)
      return blocked.length ? 1 : 0
    }
    if (blocked.length) { console.error('Nothing was written: the BLOCKED destinations above need your authorization (interactive prompt or --force).'); return 1 }

    // Review + confirm
    if (o.showFiles && !o.json) say(`${formatFiles(plan)}\n`)
    if (prompter) {
      if (!(await review(plan, prompter, ctx))) { say('Cancelled; nothing was written.'); return 1 }
    } else if (!o.yes && !o.json) {
      throw new InstallerError('Add --yes to install non-interactively (or --dry-run to preview).')
    }

    // Execute + verify (logged)
    const log = new OperationLog(join(ctx.stateDir, 'logs'), o.mode)
    // Ctrl+C during execution: finish the current destination (atomic, verified or rolled back),
    // then stop before the next one. A second Ctrl+C aborts immediately.
    let interrupted = false
    const onInterrupt = (): void => {
      if (interrupted) process.exit(130)
      interrupted = true
      console.error('\nInterrupted: finishing the current destination safely, then stopping. Press Ctrl+C again to abort now.')
    }
    process.on('SIGINT', onInterrupt)
    let results
    try {
      results = executePlan(plan, PAYLOAD, manifest, ctx, { selftest: o.selftest, log, shouldStop: () => interrupted })
    } finally {
      process.off('SIGINT', onInterrupt)
    }
    const ok = results.every((r) => r.ok)
    if (o.json) { console.log(JSON.stringify({ ok, plan, results, log: log.file ?? null }, null, 2)); return ok ? 0 : 1 }
    say(`\nStep 6 · Result\n${formatResults(results, ctx)}`)
    for (const t of skipped) say(`– ${t.agents.map((a) => adapterFor(a).displayName).join(' + ')}: ${pretty(t.dir, ctx)} — skipped, nothing written`)
    say('\nNext steps:')
    for (const id of agents) {
      const a = adapterFor(id)
      say(`  ${a.displayName}: ${a.activation(scope)} Invoke: ${a.invocation}.`)
    }
    if (log.file) say(`\nLog: ${pretty(log.file, ctx)}`)
    say(!ok ? '\nSome destinations failed and were rolled back; see above. Successful ones were kept.' : skipped.length ? '\nInstalled and verified; skipped destinations were left untouched.' : '\nInstalled and verified.')
    return ok && skipped.length === 0 ? 0 : 1
  } finally {
    prompter?.close()
  }
}

/**
 * Ask, per blocked destination, whether to back up and replace it (default: no). Declined and
 * non-authorizable destinations are removed from the plan and returned so they can be reported.
 */
async function authorizeBlocked(plan: Plan, p: Prompter, ctx: Context): Promise<Plan['targets']> {
  const blocked = plan.targets.filter((t) => t.action === 'blocked')
  if (blocked.length === 0) return []
  say('Step 4 · Authorization (existing files this installer did not write, or that changed)')
  const skipped: Plan['targets'] = []
  for (const t of blocked) {
    say(`  ${pretty(t.dir, ctx)}: ${t.reason}`)
    if (authorizable(t) && await p.confirm('  Back it up and replace it?')) authorize(plan, t)
    else { skipped.push(t); say('  → skipped; nothing will be written there.') }
  }
  plan.targets = plan.targets.filter((t) => !skipped.includes(t))
  refreshVisibility(plan, ctx)
  return skipped
}

/** Review loop: list files, show operations, then proceed or cancel. */
async function review(plan: Plan, p: Prompter, ctx: Context): Promise<boolean> {
  const actionable = plan.targets.filter((t) => t.action !== 'blocked')
  if (actionable.length === 0) return false
  say('\nStep 5 · Review')
  for (;;) {
    const a = (await p.ask('  [f] list files  [o] show operations  [y] install  [n] cancel: '))?.toLowerCase()
    if (a === undefined || a === 'n' || a === 'no') return false
    if (a === 'f') say(formatFiles(plan))
    else if (a === 'o') say(formatOperations(plan, ctx))
    else if (/^(y|yes|s|si|sí)$/.test(a)) return true
  }
}

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code },
  (e: unknown) => {
    if (e instanceof InstallerError) { console.error(`Error: ${e.message}`); process.exitCode = 2 }
    else if ((e as NodeJS.ErrnoException)?.code) { console.error(`Error: ${explainFsError(e)}`); process.exitCode = 1 }
    else { console.error(`Internal error: ${(e as Error).stack ?? String(e)}`); process.exitCode = 1 }
  },
)

