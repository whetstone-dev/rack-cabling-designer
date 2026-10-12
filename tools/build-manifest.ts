#!/usr/bin/env node
// Regenerate skills/rack-cabling-designer/MANIFEST.json (file list + SHA-256) from the payload.
// --check exits 1 when the committed manifest is out of date (used by CI).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeManifest, MANIFEST_FILE } from '../installer/lib/manifest.ts'
import { SKILL_NAME } from '../installer/lib/plan.ts'
import { checkSkill, skillVersion } from '../installer/lib/skill-format.ts'

const payload = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME)

function main(): number {
  const { parsed, issues } = checkSkill(payload)
  const version = skillVersion(parsed)
  if (!version || issues.some((i) => i.level === 'error')) {
    console.error(`SKILL.md is invalid or has no metadata.version: ${issues.map((i) => i.message).join('; ')}`)
    return 1
  }
  const manifest = computeManifest(payload, SKILL_NAME, version)
  const text = JSON.stringify(manifest, null, 2) + '\n'
  const file = join(payload, MANIFEST_FILE)
  if (process.argv.includes('--check')) {
    let current = ''
    try {
      current = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    } catch {
      current = ''
    }
    if (current !== text) {
      console.error(`${MANIFEST_FILE} is out of date. Run: node tools/build-manifest.ts`)
      return 1
    }
    console.log(`${MANIFEST_FILE} is up to date (${Object.keys(manifest.files).length} files, v${version}).`)
    return 0
  }
  writeFileSync(file, text, 'utf8')
  console.log(`Wrote ${file} (${Object.keys(manifest.files).length} files, v${version}).`)
  return 0
}

process.exitCode = main()
