// Installation self-test: runtime version, bundled data, examples and every output generator.
// Used by the installer's verification step; needs no network and writes nothing.

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SKILL_DIR, genericCatalog, mediaData, powerData } from './assets.ts'
import { bomCsv } from './outputs/bom.ts'
import { renderElevation } from './outputs/elevation.ts'
import { documentMd } from './outputs/reports.ts'
import { labelsCsv, scheduleCsv } from './outputs/schedule.ts'
import { analyze, loadModel } from './validate.ts'

const MIN_NODE: [number, number] = [22, 18]

export function nodeVersionOk(version = process.versions.node): boolean {
  const [major, minor] = version.split('.').map(Number)
  return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1])
}

export function runSelftest(): number {
  const failures: string[] = []
  const ok = (name: string, fn: () => string | void): void => {
    try {
      const detail = fn()
      console.log(`ok   ${name}${detail ? ` (${detail})` : ''}`)
    } catch (e) {
      failures.push(name)
      console.log(`FAIL ${name}: ${(e as Error).message}`)
    }
  }

  ok('node version', () => {
    if (!nodeVersionOk()) throw new Error(`Node ${process.versions.node}; need >= ${MIN_NODE.join('.')}`)
    return process.versions.node
  })
  ok('bundled data', () => `media v${mediaData().dataVersion}, power v${powerData().dataVersion}, ${genericCatalog().length} catalog types`)

  const dir = join(SKILL_DIR, 'examples')
  let files: string[] = []
  ok('examples present', () => {
    files = readdirSync(dir).filter((f) => f.endsWith('.rack.json')).sort()
    if (files.length === 0) throw new Error(`no *.rack.json in ${dir}`)
    return `${files.length}`
  })
  for (const f of files) {
    ok(`example ${f}`, () => {
      const a = analyze(loadModel(join(dir, f)))
      const broken = f.includes('broken')
      if (broken && a.counts.error === 0) throw new Error('expected errors, found none')
      if (!broken && a.counts.error > 0) throw new Error(`${a.counts.error} unexpected error(s): ${a.diagnostics.filter((d) => d.severity === 'error').map((d) => d.code).join(', ')}`)
      if (!broken) {
        const html = renderElevation(a)
        if (/<script/i.test(html)) throw new Error('elevation must not contain scripts')
        documentMd(a); scheduleCsv(a); labelsCsv(a); bomCsv(a)
      }
      return `${a.counts.error} error(s), ${a.counts.warning} warning(s)`
    })
  }

  console.log(failures.length === 0 ? '\nselftest: PASS' : `\nselftest: FAIL (${failures.join(', ')})`)
  return failures.length === 0 ? 0 : 1
}
