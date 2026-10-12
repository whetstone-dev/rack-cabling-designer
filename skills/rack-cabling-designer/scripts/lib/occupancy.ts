// Rack-unit occupancy per rack and face, shared by the rack rules, the elevation and the BOM.

import type { Category, Face } from './model.ts'
import type { Index } from './resolve.ts'

export interface Occupant {
  kind: 'device' | 'pdu'
  id: string
  label: string
  category: Category | 'pdu'
  startU: number
  heightU: number
  /** Face the equipment front looks at */
  face: Face
  fullDepth: boolean
  status?: string
}

export interface RackOccupancy {
  rackId: string
  heightU: number
  occupants: Occupant[]
  /** cells[u-1][face] = ids occupying that unit on that face (more than one = collision) */
  cells: { front: string[]; rear: string[] }[]
  /** 0U PDUs mounted on the side channels */
  sidePdus: { id: string; label: string; side: 'left' | 'right'; feed: string }[]
}

export function facesOf(o: Occupant): Face[] {
  return o.fullDepth ? ['front', 'rear'] : [o.face]
}

export function computeOccupancy(ix: Index): Map<string, RackOccupancy> {
  const result = new Map<string, RackOccupancy>()
  for (const rack of ix.racks.values()) {
    result.set(rack.id, {
      rackId: rack.id,
      heightU: rack.heightU,
      occupants: [],
      cells: Array.from({ length: rack.heightU }, () => ({ front: [], rear: [] })),
      sidePdus: [],
    })
  }

  const place = (rackId: string, o: Occupant): void => {
    const occ = result.get(rackId)
    if (!occ) return
    occ.occupants.push(o)
    for (let u = o.startU; u < o.startU + o.heightU; u++) {
      const cell = occ.cells[u - 1]
      if (!cell) continue // out of bounds is reported by the rack rules
      for (const f of facesOf(o)) cell[f].push(o.id)
    }
  }

  for (const rd of ix.devices.values()) {
    const d = rd.device
    if (!d.rack || d.position === undefined || rd.heightU === 0) continue
    place(d.rack, {
      kind: 'device',
      id: d.id,
      label: rd.label,
      category: rd.type?.category ?? 'other',
      startU: d.position,
      heightU: rd.heightU,
      face: rd.face,
      fullDepth: rd.fullDepth,
      status: d.status,
    })
  }

  for (const p of ix.pdus.values()) {
    const occ = result.get(p.rack)
    if (!occ) continue
    if (p.mounting === 'rack') {
      if (p.position === undefined) continue
      place(p.rack, { kind: 'pdu', id: p.id, label: p.name ?? p.id, category: 'pdu', startU: p.position, heightU: p.heightU ?? 1, face: p.face ?? 'rear', fullDepth: false })
    } else {
      occ.sidePdus.push({ id: p.id, label: p.name ?? p.id, side: p.mounting === '0U-right' ? 'right' : 'left', feed: p.feed })
    }
  }
  return result
}

/** Contiguous empty ranges on a face, as [startU, endU] pairs (inclusive). */
export function emptyRanges(occ: RackOccupancy, face: Face): [number, number][] {
  const out: [number, number][] = []
  let start = 0
  for (let u = 1; u <= occ.heightU + 1; u++) {
    const empty = u <= occ.heightU && occ.cells[u - 1][face].length === 0
    if (empty && !start) start = u
    if (!empty && start) { out.push([start, u - 1]); start = 0 }
  }
  return out
}
