// Indexes a model: resolves equipment types (model first, then the generic catalog),
// expands port ranges and precomputes per-device facts the rules and outputs share.

import { genericCatalog } from './assets.ts'
import type { Cable, Category, Device, EquipmentType, Face, Pdu, PortSpec, Rack, RackModel } from './model.ts'
import { UserError } from './model.ts'

const PASSIVE: Category[] = ['patch-panel', 'outlet']
const HALF_DEPTH_DEFAULT: Category[] = ['patch-panel', 'outlet', 'cable-manager', 'blanking', 'shelf']
const MAX_RANGE = 512

export interface ResolvedPort extends PortSpec { /** expanded name */ name: string }

export interface ResolvedDevice {
  device: Device
  index: number
  type?: EquipmentType
  label: string
  passive: boolean
  heightU: number
  fullDepth: boolean
  face: Face
  ports: Map<string, ResolvedPort>
}

export interface Index {
  model: RackModel
  racks: Map<string, Rack>
  types: Map<string, EquipmentType>
  devices: Map<string, ResolvedDevice>
  pdus: Map<string, Pdu>
  locations: Set<string>
  cables: Cable[]
}

/** Expand "Gi1/0/{1-48}" into Gi1/0/1 … Gi1/0/48. Names without braces are returned as-is. */
export function expandPortName(pattern: string): string[] {
  const m = /^(.*)\{(\d+)-(\d+)\}(.*)$/.exec(pattern)
  if (!m) return [pattern]
  const from = Number(m[2])
  const to = Number(m[3])
  if (to < from) throw new UserError(`Port range "${pattern}" goes backwards.`)
  if (to - from + 1 > MAX_RANGE) throw new UserError(`Port range "${pattern}" expands to more than ${MAX_RANGE} ports.`)
  const out: string[] = []
  for (let n = from; n <= to; n++) out.push(`${m[1]}${n}${m[4]}`)
  return out
}

export function isPassive(t: EquipmentType | undefined): boolean {
  return !!t && PASSIVE.includes(t.category)
}

export function deviceLabel(d: Device): string {
  return d.name ?? d.id
}

export function buildIndex(model: RackModel): Index {
  const types = new Map<string, EquipmentType>()
  for (const t of genericCatalog()) types.set(t.id, t)
  for (const t of model.equipmentTypes ?? []) types.set(t.id, t) // model overrides catalog

  const racks = new Map((model.racks ?? []).map((r) => [r.id, r]))
  const pdus = new Map((model.pdus ?? []).map((p) => [p.id, p]))
  const locations = new Set((model.locations ?? []).map((l) => l.id))
  const devices = new Map<string, ResolvedDevice>()

  model.devices.forEach((device, index) => {
    const type = types.get(device.type)
    const ports = new Map<string, ResolvedPort>()
    for (const spec of type?.ports ?? []) {
      for (const name of expandPortName(spec.name)) ports.set(name, { ...spec, name })
    }
    devices.set(device.id, {
      device,
      index,
      type,
      label: deviceLabel(device),
      passive: isPassive(type),
      heightU: type?.heightU ?? 1,
      fullDepth: type?.fullDepth ?? !(type && HALF_DEPTH_DEFAULT.includes(type.category)),
      face: device.face ?? 'front',
      ports,
    })
  })

  return { model, racks, types, devices, pdus, locations, cables: model.cables ?? [] }
}

/** Find a port by exact name, falling back to a case-insensitive match. */
export function findPort(rd: ResolvedDevice, name: string): ResolvedPort | undefined {
  const exact = rd.ports.get(name)
  if (exact) return exact
  const lower = name.toLowerCase()
  for (const [k, p] of rd.ports) if (k.toLowerCase() === lower) return p
  return undefined
}

/** Short human location of an endpoint: RACK.U07:port */
export function endpointText(ix: Index, device: string, port: string, side?: Face): string {
  const rd = ix.devices.get(device)
  if (!rd) return `${device}:${port}`
  const rack = rd.device.rack ? (ix.racks.get(rd.device.rack)?.name ?? rd.device.rack) : (rd.device.location ?? '')
  const u = rd.device.position ? `.U${String(rd.device.position).padStart(2, '0')}` : ''
  const s = rd.passive && side === 'rear' ? '(rear)' : ''
  return `${rack}${u}:${rd.label}:${port}${s}`.replace(/^:/, '')
}

/** Outlet numbering: groups are numbered consecutively from 1 in declaration order. */
export function outletConnector(pdu: Pdu, outlet: number): string | undefined {
  let n = 0
  for (const g of pdu.outlets) {
    if (outlet <= n + g.count) return g.connector
    n += g.count
  }
  return undefined
}

export function outletCount(pdu: Pdu): number {
  return pdu.outlets.reduce((a, g) => a + g.count, 0)
}
