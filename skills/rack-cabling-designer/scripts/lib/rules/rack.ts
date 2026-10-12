// Physical rack checks: bounds, collisions, depth, weight, utilization and 2-post suitability.

import type { Diagnostic } from '../model.ts'
import type { RackOccupancy } from '../occupancy.ts'
import type { Index } from '../resolve.ts'

const TWO_POST_MAX_KG = 25
const TWO_POST_MAX_DEPTH_MM = 400

export function checkRacks(ix: Index, occupancy: Map<string, RackOccupancy>, out: Diagnostic[]): void {
  const policy = ix.model.policy ?? {}

  for (const rack of ix.racks.values()) {
    const occ = occupancy.get(rack.id)
    if (!occ) continue
    const rackPath = `racks[${ix.model.racks.indexOf(rack)}]`

    // Bounds
    for (const o of occ.occupants) {
      const top = o.startU + o.heightU - 1
      if (o.startU < 1 || top > rack.heightU) {
        out.push({ code: 'RCD-RACK-BOUNDS', severity: 'error', message: `"${o.label}" occupies U${o.startU}-U${top} but rack "${rack.id}" has ${rack.heightU}U.`, path: pathOf(ix, o.kind, o.id) })
      }
    }

    // Collisions: report each pair once, with the U range they share.
    const pairs = new Map<string, { a: string; b: string; face: string; units: number[] }>()
    occ.cells.forEach((cell, i) => {
      for (const face of ['front', 'rear'] as const) {
        const ids = cell[face]
        for (let x = 0; x < ids.length; x++) {
          for (let y = x + 1; y < ids.length; y++) {
            const key = [ids[x], ids[y]].sort().join('|')
            const entry = pairs.get(key) ?? { a: ids[x], b: ids[y], face, units: [] }
            if (!entry.units.includes(i + 1)) entry.units.push(i + 1)
            pairs.set(key, entry)
          }
        }
      }
    })
    for (const p of pairs.values()) {
      out.push({ code: 'RCD-RACK-OVERLAP', severity: 'error', message: `"${p.a}" and "${p.b}" collide in rack "${rack.id}" at U${Math.min(...p.units)}-U${Math.max(...p.units)} (${p.face}).`, path: pathOf(ix, ix.devices.has(p.b) ? 'device' : 'pdu', p.b) })
    }

    // Depth
    for (const o of occ.occupants) {
      if (o.kind !== 'device') continue
      const depth = ix.devices.get(o.id)?.type?.depthMm
      if (rack.depthMm && depth && depth > rack.depthMm) {
        out.push({ code: 'RCD-RACK-DEPTH', severity: 'error', message: `"${o.label}" is ${depth} mm deep; rack "${rack.id}" is ${rack.depthMm} mm.`, path: pathOf(ix, 'device', o.id) })
      }
    }
    if (rack.depthMm) {
      const front = occ.occupants.filter((o) => o.kind === 'device' && !o.fullDepth && o.face === 'front')
      const rear = occ.occupants.filter((o) => o.kind === 'device' && !o.fullDepth && o.face === 'rear')
      for (const f of front) {
        for (const r of rear) {
          const overlap = f.startU < r.startU + r.heightU && r.startU < f.startU + f.heightU
          const df = ix.devices.get(f.id)?.type?.depthMm ?? 0
          const dr = ix.devices.get(r.id)?.type?.depthMm ?? 0
          if (overlap && df + dr > rack.depthMm) {
            out.push({ code: 'RCD-RACK-DEPTH', severity: 'warning', message: `Front "${f.label}" (${df} mm) and rear "${r.label}" (${dr} mm) share units but together exceed the ${rack.depthMm} mm rack depth.`, path: pathOf(ix, 'device', r.id) })
          }
        }
      }
    } else if (occ.occupants.some((o) => o.kind === 'device' && ix.devices.get(o.id)?.type?.depthMm)) {
      out.push({ code: 'RCD-RACK-DEPTH', severity: 'info', message: `Rack "${rack.id}" has no depthMm; equipment depth fit was not checked.`, path: `${rackPath}.depthMm` })
    }

    // Weight
    let kg = 0
    let unknown = 0
    for (const o of occ.occupants) {
      const w = o.kind === 'device' ? ix.devices.get(o.id)?.type?.weightKg : ix.pdus.get(o.id)?.weightKg
      if (w === undefined) unknown++
      else kg += w
    }
    for (const s of occ.sidePdus) kg += ix.pdus.get(s.id)?.weightKg ?? 0
    if (rack.maxLoadKg) {
      if (kg > rack.maxLoadKg) out.push({ code: 'RCD-RACK-WEIGHT', severity: 'error', message: `Rack "${rack.id}" carries ${kg.toFixed(1)} kg; its rated load is ${rack.maxLoadKg} kg.`, path: `${rackPath}.maxLoadKg` })
      else if (kg > rack.maxLoadKg * 0.9) out.push({ code: 'RCD-RACK-WEIGHT', severity: 'warning', message: `Rack "${rack.id}" is at ${Math.round((kg / rack.maxLoadKg) * 100)}% of its rated load (${kg.toFixed(1)}/${rack.maxLoadKg} kg).`, path: `${rackPath}.maxLoadKg` })
    }
    if (unknown > 0) out.push({ code: 'RCD-RACK-WEIGHT', severity: 'info', message: `Rack "${rack.id}": ${unknown} item(s) have no weight; the load total (${kg.toFixed(1)} kg) is incomplete.`, path: rackPath })

    // Utilization (front face, as seen when planning growth)
    const used = occ.cells.filter((c) => c.front.length > 0).length
    if (policy.maxRackUtilization !== undefined && used / rack.heightU > policy.maxRackUtilization) {
      out.push({ code: 'RCD-RACK-UTIL', severity: 'warning', message: `Rack "${rack.id}" front is ${Math.round((used / rack.heightU) * 100)}% used; policy allows ${Math.round(policy.maxRackUtilization * 100)}%.`, path: rackPath })
    }

    // 2-post racks are for light, shallow equipment.
    if (rack.posts === 2) {
      for (const o of occ.occupants) {
        if (o.kind !== 'device') continue
        const t = ix.devices.get(o.id)?.type
        if ((t?.weightKg ?? 0) > TWO_POST_MAX_KG || (t?.depthMm ?? 0) > TWO_POST_MAX_DEPTH_MM) {
          out.push({ code: 'RCD-RACK-2POST', severity: 'warning', message: `"${o.label}" (${t?.weightKg ?? '?'} kg, ${t?.depthMm ?? '?'} mm) on 2-post rack "${rack.id}": check the manufacturer's 2-post kit and load rating, or use a 4-post rack.`, path: pathOf(ix, 'device', o.id) })
        }
      }
    }
  }
}

export function pathOf(ix: Index, kind: 'device' | 'pdu', id: string): string {
  if (kind === 'device') {
    const rd = ix.devices.get(id)
    return rd ? `devices[${rd.index}]` : 'devices'
  }
  const i = (ix.model.pdus ?? []).findIndex((p) => p.id === id)
  return i >= 0 ? `pdus[${i}]` : 'pdus'
}
