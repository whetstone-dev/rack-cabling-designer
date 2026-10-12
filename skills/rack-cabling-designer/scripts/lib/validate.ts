// Loads a *.rack.json model and runs every rule. One analysis feeds all outputs.

import { readFileSync, statSync } from 'node:fs'
import { buildAdjacency, traceChannels, type Channel } from './channels.ts'
import type { Diagnostic, RackModel } from './model.ts'
import { UserError } from './model.ts'
import { computeOccupancy, type RackOccupancy } from './occupancy.ts'
import { computePower, type PowerReport } from './power.ts'
import { buildIndex, type Index } from './resolve.ts'
import { checkAirflow } from './rules/airflow.ts'
import { checkCabling } from './rules/cabling.ts'
import { checkIntegrity } from './rules/integrity.ts'
import { checkLabels } from './rules/labels.ts'
import { checkPower } from './rules/power.ts'
import { checkRacks } from './rules/rack.ts'
import { validateSchema } from './schema.ts'

const MAX_MODEL_BYTES = 10 * 1024 * 1024

export interface Analysis {
  model: RackModel
  index: Index
  occupancy: Map<string, RackOccupancy>
  channels: Channel[]
  power: PowerReport
  diagnostics: Diagnostic[]
  counts: { error: number; warning: number; info: number }
}

export function loadModel(file: string): RackModel {
  let size: number
  try {
    size = statSync(file).size
  } catch {
    throw new UserError(`Model file not found: ${file}`)
  }
  if (size > MAX_MODEL_BYTES) throw new UserError(`Model file is larger than ${MAX_MODEL_BYTES / 1024 / 1024} MB: ${file}`)
  let text: string
  try {
    text = readFileSync(file, 'utf8').replace(/^﻿/, '')
  } catch (e) {
    throw new UserError(`Could not read ${file}: ${(e as Error).message}`)
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new UserError(`${file} must contain a JSON object.`)
    return parsed as RackModel
  } catch (e) {
    if (e instanceof UserError) throw e
    throw new UserError(`${file} is not valid JSON: ${(e as Error).message}`)
  }
}

const ORDER = { error: 0, warning: 1, info: 2 }

/** Run schema validation, then (only for a schema-valid model) every domain rule. */
export function analyze(model: RackModel): Analysis {
  const diagnostics = validateSchema(model)
  if (diagnostics.length > 0) {
    // Domain rules assume a well-formed model; report schema problems first.
    const empty: RackModel = { modelVersion: 1, meta: { name: '' }, racks: [], devices: [] }
    const index = buildIndex(empty)
    return { model, index, occupancy: new Map(), channels: [], power: computePower(index), diagnostics, counts: { error: diagnostics.length, warning: 0, info: 0 } }
  }

  const index = buildIndex(model)
  const occupancy = computeOccupancy(index)
  const adjacency = buildAdjacency(index)
  const channels = traceChannels(index, adjacency)
  const power = computePower(index)

  checkIntegrity(index, diagnostics)
  checkRacks(index, occupancy, diagnostics)
  checkAirflow(index, occupancy, diagnostics)
  checkPower(index, power, diagnostics)
  checkCabling(index, adjacency, channels, diagnostics)
  checkLabels(index, diagnostics)

  diagnostics.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
  const counts = { error: 0, warning: 0, info: 0 }
  for (const d of diagnostics) counts[d.severity]++
  return { model, index, occupancy, channels, power, diagnostics, counts }
}

/** Gate used by build/outputs: errors always fail; strict mode also fails on warnings. */
export function passes(a: Analysis, strict: boolean): boolean {
  return a.counts.error === 0 && (!strict || a.counts.warning === 0)
}
