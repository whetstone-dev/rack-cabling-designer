#!/usr/bin/env node
// rackcab — validation and documentation toolkit of the rack-cabling-designer skill.
// Node.js >= 22.18 (runs TypeScript natively), zero dependencies. Run "help" for usage.

import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ASSETS_DIR, SKILL_DIR, genericCatalog } from './lib/assets.ts'
import { endpointText, findPort } from './lib/resolve.ts'
import { UserError, type Diagnostic } from './lib/model.ts'
import { safeOutputPath, writeText } from './lib/output.ts'
import { bomCsv, bomMd } from './lib/outputs/bom.ts'
import { renderElevation } from './lib/outputs/elevation.ts'
import { documentMd, powerMd } from './lib/outputs/reports.ts'
import { labelsCsv, scheduleCsv, scheduleMd } from './lib/outputs/schedule.ts'
import { runSelftest } from './lib/selftest.ts'
import { analyze, loadModel, passes, type Analysis } from './lib/validate.ts'

const HELP = `rackcab — rack, cabling and power design checks (rack-cabling-designer skill)

Usage: node rackcab.ts <command> [options]

  validate <model> [--strict] [--json]     Schema + rack, power, airflow, cabling and label rules
  build <model> [-o dir] [--strict]        elevation.html, README.md, cable-schedule.csv, labels.csv,
                                           bom.csv, power.md, report.json (gated by validation)
  elevation <model> [-o file.html]         Front/rear rack elevations (self-contained HTML)
  schedule <model> [--format csv|md] [-o file]   Cable schedule by channel
  labels <model> [-o file.csv]             Two labels per cable (one per end)
  bom <model> [--format md|csv] [-o file]  Bill of materials
  power <model> [-o file.md]               Power budget with derating and feed-failure loads
  trace <model> <device>:<port>[:rear]     End-to-end channel through panels and outlets
  init <file.rack.json> [--force]          Starter model linked to the JSON Schema
  catalog [--json]                         Generic equipment types usable as "type"
  selftest                                 Check the installation (examples + rules)
  version | help

Options:
  --strict          warnings also fail the gate
  --allow-invalid   write outputs even when the gate fails (still exits 1)
Exit codes: 0 ok · 1 validation gate failed · 2 usage or input error · 3 internal error`

interface Args { cmd: string; pos: string[]; flags: Map<string, string | true> }

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string | true>()
  const pos: string[] = []
  const valued = new Set(['-o', '--out', '--format'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (valued.has(a)) {
      const v = argv[++i]
      if (v === undefined) throw new UserError(`${a} needs a value.`)
      flags.set(a === '--out' ? '-o' : a, v)
    } else if (a.startsWith('--')) flags.set(a, true)
    else pos.push(a)
  }
  return { cmd: pos.shift() ?? 'help', pos, flags }
}

function version(): string {
  const text = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')
  return /^\s+version:\s*"?([^"\n]+)"?/m.exec(text)?.[1] ?? 'unknown'
}

function needModel(args: Args): Analysis {
  const file = args.pos[0]
  if (!file) throw new UserError(`"${args.cmd}" needs a model file. Run "help".`)
  return analyze(loadModel(file))
}

function printFindings(diags: Diagnostic[]): void {
  const icon = { error: '✖', warning: '▲', info: '·' }
  for (const d of diags) console.log(`${icon[d.severity]} ${d.severity.padEnd(7)} ${d.code.padEnd(22)} ${d.message}`)
}

function summary(a: Analysis): string {
  return `${a.counts.error} error(s), ${a.counts.warning} warning(s), ${a.counts.info} info · ${a.index.racks.size} rack(s), ${a.model.devices.length} device(s), ${a.index.cables.length} cable(s), ${a.channels.length} channel(s)`
}

/** Returns false (and prints why) when the gate blocks generation. */
function gate(a: Analysis, args: Args): boolean {
  if (passes(a, args.flags.has('--strict'))) return true
  printFindings(a.diagnostics.filter((d) => d.severity !== 'info'))
  console.error(`\nValidation gate failed: ${summary(a)}.`)
  if (args.flags.has('--allow-invalid')) {
    console.error('--allow-invalid: writing outputs anyway; treat them as drafts.')
    return true
  }
  console.error('Fix the model, or pass --allow-invalid to write draft outputs.')
  return false
}

function emit(args: Args, content: string, defaultName?: string): void {
  const out = args.flags.get('-o')
  if (typeof out === 'string') {
    const target = resolve(out)
    writeText(safeOutputPath(resolve(target, '..'), basename(target)), content)
    console.log(`Wrote ${target}`)
  } else if (defaultName) {
    const target = resolve(defaultName)
    writeText(safeOutputPath(process.cwd(), defaultName), content)
    console.log(`Wrote ${target}`)
  } else {
    process.stdout.write(content)
  }
}

function modelStem(file: string): string {
  return basename(file).replace(/\.rack\.json$|\.json$/i, '')
}

function run(argv: string[]): number {
  const args = parseArgs(argv)
  switch (args.cmd) {
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP)
      return 0
    case 'version':
    case '--version':
      console.log(version())
      return 0
    case 'selftest':
      return runSelftest()
    case 'catalog': {
      const types = genericCatalog()
      if (args.flags.has('--json')) console.log(JSON.stringify(types, null, 2))
      else for (const t of types) console.log(`${t.id.padEnd(30)} ${String(t.heightU).padStart(2)}U  ${t.category.padEnd(14)} ${t.model ?? ''}`)
      return 0
    }
    case 'init': {
      const file = args.pos[0]
      if (!file) throw new UserError('init needs a target file, e.g. init site.rack.json')
      if (existsSync(file) && !args.flags.has('--force')) throw new UserError(`${file} already exists (use --force to overwrite).`)
      const skeleton = JSON.parse(readFileSync(join(ASSETS_DIR, 'templates', 'model-skeleton.rack.json'), 'utf8')) as Record<string, unknown>
      skeleton.$schema = pathToFileURL(join(ASSETS_DIR, 'schema', 'rack-model.schema.json')).href
      const target = resolve(file)
      writeText(safeOutputPath(resolve(target, '..'), basename(target)), JSON.stringify(skeleton, null, 2) + '\n')
      console.log(`Created ${target}. Next: edit it, then run "validate ${file}".`)
      return 0
    }
    case 'validate': {
      const a = needModel(args)
      const ok = passes(a, args.flags.has('--strict'))
      if (args.flags.has('--json')) {
        console.log(JSON.stringify({ ok, strict: args.flags.has('--strict'), counts: a.counts, diagnostics: a.diagnostics }, null, 2))
      } else {
        printFindings(a.diagnostics)
        console.log(`\n${ok ? 'PASS' : 'FAIL'}: ${summary(a)}${args.flags.has('--strict') ? ' (strict)' : ''}`)
      }
      return ok ? 0 : 1
    }
    case 'build': {
      const a = needModel(args)
      const ok = passes(a, args.flags.has('--strict'))
      if (!gate(a, args)) return 1
      const outFlag = args.flags.get('-o')
      const dir = resolve(typeof outFlag === 'string' ? outFlag : `${modelStem(args.pos[0])}-build`)
      const files: [string, string][] = [
        ['elevation.html', renderElevation(a)],
        ['README.md', documentMd(a)],
        ['cable-schedule.csv', scheduleCsv(a)],
        ['labels.csv', labelsCsv(a)],
        ['bom.csv', bomCsv(a)],
        ['power.md', powerMd(a)],
        ['report.json', JSON.stringify({ ok, counts: a.counts, diagnostics: a.diagnostics, channels: a.channels.map((c) => ({ id: c.id, cables: c.segments.map((s) => s.cable.id), totalM: c.totalM ?? null, speed: c.speed ?? null })) }, null, 2) + '\n'],
      ]
      for (const [name, content] of files) writeText(safeOutputPath(dir, name), content)
      console.log(`${ok ? 'Built' : 'Built DRAFT'} ${files.length} files in ${dir}\n${summary(a)}`)
      return ok ? 0 : 1
    }
    case 'elevation': {
      const a = needModel(args)
      if (!gate(a, args)) return 1
      emit(args, renderElevation(a), `${modelStem(args.pos[0])}-elevation.html`)
      return passes(a, args.flags.has('--strict')) ? 0 : 1
    }
    case 'schedule':
    case 'labels':
    case 'bom':
    case 'power': {
      const a = needModel(args)
      if (!gate(a, args)) return 1
      const format = args.flags.get('--format')
      if (format !== undefined && format !== 'csv' && format !== 'md') throw new UserError('--format must be csv or md.')
      const content = args.cmd === 'schedule' ? (format === 'md' ? scheduleMd(a) : scheduleCsv(a))
        : args.cmd === 'labels' ? labelsCsv(a)
          : args.cmd === 'bom' ? (format === 'csv' ? bomCsv(a) : bomMd(a))
            : powerMd(a)
      emit(args, content)
      return passes(a, args.flags.has('--strict')) ? 0 : 1
    }
    case 'trace': {
      const a = needModel(args)
      const spec = args.pos[1]
      if (!spec) throw new UserError('trace needs <device>:<port>[:rear], e.g. trace site.rack.json leaf1:Eth1/1')
      const m = /^([^:]+):(.+?)(?::(front|rear))?$/.exec(spec)
      if (!m) throw new UserError(`Cannot parse "${spec}"; use <device>:<port>[:rear].`)
      const rd = a.index.devices.get(m[1])
      if (!rd) throw new UserError(`Unknown device "${m[1]}".`)
      const port = findPort(rd, m[2])?.name ?? m[2]
      const side = rd.passive ? (m[3] ?? 'front') : 'front'
      const ch = a.channels.find((c) => c.segments.some((s) => [s.from, s.to].some((n) => n.device === rd.device.id && n.port === port && (!rd.passive || n.side === side))))
      if (!ch) {
        console.log(`${endpointText(a.index, rd.device.id, port, side as 'front' | 'rear')}: no cable connected.`)
        return 0
      }
      console.log(`${ch.id} · ${ch.segments.length} cable(s) · ${ch.totalM ?? 'unknown'} m${ch.speed ? ` · ${ch.speed}` : ''}${ch.openStart || ch.openEnd ? ' · open at a panel/outlet' : ''}`)
      ch.segments.forEach((s, n) => {
        console.log(`  ${n + 1}. ${s.cable.label ?? s.cable.id} · ${s.cable.media} · ${s.cable.lengthM ?? '?'} m · ${s.kind}`)
        console.log(`     ${endpointText(a.index, s.from.device, s.from.port, s.from.side)}  →  ${endpointText(a.index, s.to.device, s.to.port, s.to.side)}`)
      })
      const related = a.diagnostics.filter((d) => ch.segments.some((s) => d.path?.startsWith(`cables[${s.cableIndex}]`)))
      if (related.length) { console.log(''); printFindings(related) }
      return 0
    }
    default:
      throw new UserError(`Unknown command "${args.cmd}". Run "help".`)
  }
}

try {
  process.exitCode = run(process.argv.slice(2))
} catch (e) {
  if (e instanceof UserError) {
    console.error(`Error: ${e.message}`)
    process.exitCode = 2
  } else {
    console.error(`Internal error: ${(e as Error).stack ?? String(e)}`)
    process.exitCode = 3
  }
}
