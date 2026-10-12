// Airflow rules: equipment must take air from the cold aisle; side-breathing gear needs ducting;
// empty units on the cold face should be closed with blanking panels.

import type { Diagnostic, Face } from '../model.ts'
import { emptyRanges, type RackOccupancy } from '../occupancy.ts'
import type { Index } from '../resolve.ts'

const opposite = (f: Face): Face => (f === 'front' ? 'rear' : 'front')

export function checkAirflow(ix: Index, occupancy: Map<string, RackOccupancy>, out: Diagnostic[]): void {
  const policy = ix.model.policy ?? {}

  for (const rack of ix.racks.values()) {
    const frontAisle = rack.frontAisle ?? 'cold'
    if (frontAisle === 'none') continue
    const occ = occupancy.get(rack.id)
    if (!occ) continue
    let active = 0

    for (const o of occ.occupants) {
      if (o.kind !== 'device') continue
      const rd = ix.devices.get(o.id)!
      const airflow = rd.type?.airflow
      const path = `devices[${rd.index}]`
      if (!airflow || airflow === 'passive') {
        if (!airflow && !rd.passive && rd.type && !['cable-manager', 'blanking', 'shelf'].includes(rd.type.category)) {
          out.push({ code: 'RCD-AIR-DATA', severity: 'info', message: `"${rd.label}" has no airflow direction; airflow was not checked.`, path })
        }
        continue
      }
      active++
      if (airflow === 'side-to-side') {
        out.push({ code: 'RCD-AIR-SIDE', severity: 'warning', message: `"${rd.label}" breathes side-to-side; in a hot/cold aisle rack it needs a side-intake duct or baffle kit.`, path })
        continue
      }
      const intakeFace = airflow === 'front-to-back' ? rd.face : opposite(rd.face)
      const intakeAisle = intakeFace === 'front' ? frontAisle : frontAisle === 'cold' ? 'hot' : 'cold'
      if (intakeAisle === 'hot') {
        out.push({ code: 'RCD-AIR-RECIRC', severity: 'error', message: `"${rd.label}" (${airflow}, mounted facing ${rd.face}) takes air from the hot aisle of rack "${rack.id}". Reverse its mounting or order the opposite airflow option.`, path })
      }
    }

    if (active === 0) continue
    const coldFace: Face = frontAisle === 'cold' ? 'front' : 'rear'
    const gaps = emptyRanges(occ, coldFace)
    if (gaps.length > 0) {
      const units = gaps.reduce((a, [s, e]) => a + (e - s + 1), 0)
      const list = gaps.map(([s, e]) => (s === e ? `U${s}` : `U${s}-U${e}`)).join(', ')
      out.push({ code: 'RCD-AIR-BLANKING', severity: policy.requireBlankingPanels ? 'warning' : 'info', message: `Rack "${rack.id}" has ${units} open unit(s) on the cold face (${list}); fit blanking panels to stop hot-air recirculation.`, path: `racks[${ix.model.racks.indexOf(rack)}]` })
    }
  }
}
