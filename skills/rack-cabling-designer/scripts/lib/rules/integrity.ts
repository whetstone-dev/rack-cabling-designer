// Identity and reference checks: duplicate ids and references to things that do not exist.

import type { Diagnostic } from '../model.ts'
import type { Index } from '../resolve.ts'

export function checkIntegrity(ix: Index, out: Diagnostic[]): void {
  const m = ix.model
  const add = (code: string, message: string, path: string): void => { out.push({ code, severity: 'error', message, path }) }

  // Racks, devices and PDUs share one namespace because cables and power links refer to them by id.
  const seen = new Map<string, string>()
  const claim = (id: string, path: string): void => {
    const prev = seen.get(id)
    if (prev) add('RCD-DUP-ID', `Duplicate id "${id}" (${path} and ${prev}).`, path)
    else seen.set(id, path)
  }
  m.racks.forEach((r, i) => claim(r.id, `racks[${i}]`))
  m.devices.forEach((d, i) => claim(d.id, `devices[${i}]`))
  ;(m.pdus ?? []).forEach((p, i) => claim(p.id, `pdus[${i}]`))

  const unique = (items: { id: string }[] | undefined, name: string): void => {
    const ids = new Set<string>()
    ;(items ?? []).forEach((x, i) => {
      if (ids.has(x.id)) add('RCD-DUP-ID', `Duplicate ${name} id "${x.id}".`, `${name}[${i}]`)
      ids.add(x.id)
    })
  }
  unique(m.locations, 'locations')
  unique(m.equipmentTypes, 'equipmentTypes')
  unique(m.cables, 'cables')

  ;(m.locations ?? []).forEach((l, i) => {
    if (l.parent && !ix.locations.has(l.parent)) add('RCD-REF', `Location "${l.id}" has unknown parent "${l.parent}".`, `locations[${i}].parent`)
    if (l.parent === l.id) add('RCD-REF', `Location "${l.id}" is its own parent.`, `locations[${i}].parent`)
  })
  m.racks.forEach((r, i) => {
    if (r.location && !ix.locations.has(r.location)) add('RCD-REF', `Rack "${r.id}" references unknown location "${r.location}".`, `racks[${i}].location`)
  })

  for (const rd of ix.devices.values()) {
    const d = rd.device
    const p = `devices[${rd.index}]`
    if (!rd.type) add('RCD-REF', `Device "${d.id}" uses unknown equipment type "${d.type}" (define it in equipmentTypes or use a catalog id; run "catalog").`, `${p}.type`)
    if (d.rack && !ix.racks.has(d.rack)) add('RCD-REF', `Device "${d.id}" references unknown rack "${d.rack}".`, `${p}.rack`)
    if (d.location && !ix.locations.has(d.location)) add('RCD-REF', `Device "${d.id}" references unknown location "${d.location}".`, `${p}.location`)
    if (d.position !== undefined && !d.rack) add('RCD-RACK-POSITION', `Device "${d.id}" has a position but no rack.`, `${p}.position`)
    if (d.rack && d.position === undefined && rd.heightU > 0) add('RCD-RACK-POSITION', `Device "${d.id}" is in rack "${d.rack}" but has no position (lowest U).`, `${p}.position`)
  }

  ;(m.pdus ?? []).forEach((pdu, i) => {
    if (!ix.racks.has(pdu.rack)) add('RCD-REF', `PDU "${pdu.id}" references unknown rack "${pdu.rack}".`, `pdus[${i}].rack`)
    if (pdu.mounting === 'rack' && pdu.position === undefined) add('RCD-RACK-POSITION', `PDU "${pdu.id}" is rack-mounted but has no position.`, `pdus[${i}].position`)
  })

  ;(m.powerLinks ?? []).forEach((l, i) => {
    if (!ix.devices.has(l.device)) add('RCD-REF', `Power link references unknown device "${l.device}".`, `powerLinks[${i}].device`)
    if (!ix.pdus.has(l.pdu)) add('RCD-REF', `Power link references unknown PDU "${l.pdu}".`, `powerLinks[${i}].pdu`)
  })

  ix.cables.forEach((c, i) => {
    for (const end of ['a', 'b'] as const) {
      if (!ix.devices.has(c[end].device)) add('RCD-REF', `Cable "${c.id}" end ${end.toUpperCase()} references unknown device "${c[end].device}".`, `cables[${i}].${end}.device`)
    }
  })
}
