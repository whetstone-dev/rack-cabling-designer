#!/usr/bin/env node
// Lint the skill against the Agent Skills spec (same rules skills-ref enforces, plus the Claude
// API upload rules) and check that every relative link in SKILL.md and references/ resolves.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SKILL_NAME } from '../installer/lib/plan.ts'
import { checkSkill } from '../installer/lib/skill-format.ts'

const payload = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME)

function links(file: string): string[] {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
  const out: string[] = []
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1]
    if (/^(https?:|mailto:|#)/.test(href)) continue
    out.push(href.split('#')[0])
  }
  return out
}

function main(): number {
  const { issues } = checkSkill(payload)
  const problems = issues.map((i) => `${i.level}: ${i.message}`)
  const docs = [join(payload, 'SKILL.md'), ...readdirSync(join(payload, 'references')).filter((f) => f.endsWith('.md')).map((f) => join(payload, 'references', f))]
  for (const doc of docs) {
    for (const href of links(doc)) {
      if (!existsSync(resolve(dirname(doc), href))) problems.push(`error: broken link "${href}" in ${doc.slice(payload.length + 1)}`)
    }
  }
  for (const p of problems) console.log(p)
  const errors = problems.filter((p) => p.startsWith('error')).length
  console.log(errors ? `\nlint-skill: FAIL (${errors} error(s))` : `\nlint-skill: PASS (${docs.length} documents checked)`)
  return errors ? 1 : 0
}

process.exitCode = main()
