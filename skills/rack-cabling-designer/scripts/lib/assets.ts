// Access to the bundled data files under assets/ (schema, normative data, catalog).
// Resolved relative to this script so the skill works from any install location.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EquipmentType, Speed } from './model.ts'

export const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const ASSETS_DIR = join(SKILL_DIR, 'assets')

const cache = new Map<string, unknown>()

/** Read and parse a JSON file under assets/. Throws with the file path on failure. */
export function readJsonAsset<T>(relative: string): T {
  const hit = cache.get(relative)
  if (hit !== undefined) return hit as T
  const file = join(ASSETS_DIR, relative)
  let parsed: T
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as T
  } catch (e) {
    throw new Error(`Could not read bundled data file ${file}: ${(e as Error).message}`)
  }
  cache.set(relative, parsed)
  return parsed
}

export interface Reach { maxM: number; source: string }
export interface MediaInfo { family: 'copper' | 'fiber-mm' | 'fiber-sm' | 'direct-attach'; label: string; reach: Partial<Record<Speed, Reach>> }
export interface MediaData {
  dataVersion: string
  speeds: Speed[]
  channelModel: { copperChannelMaxM: number; copperPermanentLinkMaxM: number; copperCordsTotalMaxM: number; source: string }
  media: Record<string, MediaInfo>
  optics: Record<string, Partial<Record<Speed, string>>>
  parallelOptics: string[]
}
export interface PowerData {
  dataVersion: string
  defaultDerating: number
  deratingSource: string
  wattsToBtuPerHour: number
  inletOutlet: Record<string, { ok: string[]; adapter: string[] }>
}

export const mediaData = (): MediaData => readJsonAsset<MediaData>('data/media.json')
export const powerData = (): PowerData => readJsonAsset<PowerData>('data/power.json')
export const genericCatalog = (): EquipmentType[] => readJsonAsset<{ equipmentTypes: EquipmentType[] }>('catalog/generic.json').equipmentTypes
