// Bill of materials: equipment, PDUs, cords and bulk cable, transceivers, power cords, blanking panels.

import { mediaData } from '../assets.ts'
import { connectorAt } from '../rules/cabling.ts'
import { csvRow, mdTable } from '../escape.ts'
import { emptyRanges } from '../occupancy.ts'
import { findPort } from '../resolve.ts'
import type { Analysis } from '../validate.ts'

export interface BomLine { group: string; item: string; quantity: number; unit: string; notes: string }

const DEFAULT_STOCK = [0.5, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50]

export function computeBom(a: Analysis): BomLine[] {
  const policy = a.model.policy ?? {}
  const stock = [...(policy.stockLengthsM ?? DEFAULT_STOCK)].sort((x, y) => x - y)
  const slack = (policy.cableSlackPercent ?? 10) / 100
  const md = mediaData()
  const lines: BomLine[] = []
  const bump = (group: string, item: string, unit: string, qty: number, notes = ''): void => {
    const hit = lines.find((l) => l.group === group && l.item === item && l.unit === unit)
    if (hit) hit.quantity += qty
    else lines.push({ group, item, quantity: qty, unit, notes })
  }

  for (const rd of a.index.devices.values()) {
    if (rd.device.status === 'remove') continue
    const t = rd.type
    const name = t ? [t.manufacturer, t.model].filter(Boolean).join(' ') || t.id : rd.device.type
    bump('Equipment', `${name} [${rd.device.type}]`, 'pcs', 1, t?.category ?? '')
  }
  for (const p of a.index.pdus.values()) {
    const outlets = p.outlets.map((g) => `${g.count}x${g.connector}`).join(' + ')
    bump('Power distribution', `PDU ${p.voltage} V ${p.maxAmps} A ${p.phases === 3 ? '3-phase' : '1-phase'}, ${outlets}, ${p.mounting ?? '0U-left'}`, 'pcs', 1)
  }

  for (const ch of a.channels) {
    for (const s of ch.segments) {
      const c = s.cable
      if (c.status === 'remove') continue
      const info = md.media[c.media]
      if (s.kind === 'permanent') {
        const len = c.lengthM === undefined ? 0 : Math.ceil(c.lengthM * (1 + slack))
        bump('Bulk cable', `${info?.label ?? c.media} (installed link)`, 'm', len, c.lengthM === undefined ? 'some lengths unknown' : `includes ${Math.round(slack * 100)}% slack`)
        bump('Terminations', `${info?.family === 'copper' ? 'Keystone/punch-down terminations' : 'Fiber terminations (connector pairs)'}`, 'pcs', 2)
      } else {
        const len = c.lengthM === undefined ? undefined : stock.find((x) => x >= c.lengthM!) ?? Math.ceil(c.lengthM)
        const kind = info?.family === 'direct-attach' ? c.media.toUpperCase() : `${info?.label ?? c.media} patch cord`
        bump('Cords', `${kind} ${len === undefined ? 'length TBD' : `${len} m`}${c.color ? `, ${c.color}` : ''}`, 'pcs', 1)
      }
      // Transceivers for fiber or copper modules in cages
      for (const n of [s.from, s.to]) {
        const rd = a.index.devices.get(n.device)
        if (!rd || rd.passive) continue
        const port = findPort(rd, n.port)
        if (!port || !['sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28'].includes(connectorAt(port, false, 'front'))) continue
        if (!info || info.family === 'direct-attach') continue
        const speed = port.speed ?? ch.speed
        const optic = speed ? md.optics[info.family]?.[speed] : undefined
        bump('Transceivers', `${optic ?? `${info.family} module (speed unknown)`} ${port.connector.toUpperCase()}`, 'pcs', 1, 'verify vendor compatibility')
      }
    }
  }

  for (const l of a.model.powerLinks ?? []) {
    const inlet = a.index.devices.get(l.device)?.type?.power?.inlets?.find((x) => x.id === l.inlet)
    bump('Power cords', `Power cord to ${inlet?.connector ?? 'device inlet'}`, 'pcs', 1)
  }

  for (const [rackId, occ] of a.occupancy) {
    const rack = a.index.racks.get(rackId)
    if (!rack || (rack.frontAisle ?? 'cold') === 'none') continue
    const face = (rack.frontAisle ?? 'cold') === 'cold' ? 'front' : 'rear'
    const units = emptyRanges(occ, face).reduce((s, [x, y]) => s + (y - x + 1), 0)
    if (units > 0) bump('Rack accessories', 'Blanking panel 1U', 'pcs', units, 'fill open units on the cold face')
  }

  bump('Labels', 'Cable labels (one per end)', 'pcs', a.index.cables.filter((c) => c.status !== 'remove').length * 2)
  return lines.filter((l) => l.quantity > 0)
}

const HEAD = ['Group', 'Item', 'Qty', 'Unit', 'Notes']

export function bomMd(a: Analysis): string {
  return mdTable(HEAD, computeBom(a).map((l) => [l.group, l.item, l.quantity, l.unit, l.notes]))
}

export function bomCsv(a: Analysis): string {
  return [csvRow(HEAD), ...computeBom(a).map((l) => csvRow([l.group, l.item, l.quantity, l.unit, l.notes]))].join('\n') + '\n'
}
