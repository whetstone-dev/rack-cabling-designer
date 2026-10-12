// Power rules: outlet use, connector fit, inlet wiring, A/B redundancy and capacity with derating.

import { powerData } from '../assets.ts'
import type { Category, Diagnostic } from '../model.ts'
import type { PowerReport } from '../power.ts'
import { outletConnector, outletCount, type Index } from '../resolve.ts'

const POWERED: Category[] = ['switch', 'router', 'firewall', 'server', 'storage', 'ups', 'kvm', 'other']

export function checkPower(ix: Index, report: PowerReport, out: Diagnostic[]): void {
  const policy = ix.model.policy ?? {}
  const table = powerData().inletOutlet
  const links = ix.model.powerLinks ?? []
  const usedOutlets = new Map<string, number>()
  const usedInlets = new Map<string, number>()

  links.forEach((l, i) => {
    const path = `powerLinks[${i}]`
    const pdu = ix.pdus.get(l.pdu)
    const rd = ix.devices.get(l.device)
    if (!pdu || !rd) return // reported by integrity

    if (l.outlet > outletCount(pdu)) {
      out.push({ code: 'RCD-PWR-OUTLET', severity: 'error', message: `PDU "${pdu.id}" has ${outletCount(pdu)} outlets; outlet ${l.outlet} does not exist.`, path: `${path}.outlet` })
    }
    const okey = `${pdu.id}#${l.outlet}`
    if (usedOutlets.has(okey)) out.push({ code: 'RCD-PWR-OUTLET', severity: 'error', message: `Outlet ${l.outlet} of PDU "${pdu.id}" is used by more than one power link (also powerLinks[${usedOutlets.get(okey)}]).`, path })
    else usedOutlets.set(okey, i)

    const ikey = `${l.device}#${l.inlet}`
    if (usedInlets.has(ikey)) out.push({ code: 'RCD-PWR-INLET', severity: 'error', message: `Inlet "${l.inlet}" of "${rd.label}" is connected twice.`, path })
    else usedInlets.set(ikey, i)

    const inlets = rd.type?.power?.inlets
    const inlet = inlets?.find((x) => x.id === l.inlet)
    if (inlets && !inlet) {
      out.push({ code: 'RCD-PWR-INLET', severity: 'error', message: `"${rd.label}" has no inlet "${l.inlet}" (available: ${inlets.map((x) => x.id).join(', ') || 'none'}).`, path: `${path}.inlet` })
    }

    const outConn = outletConnector(pdu, l.outlet)
    const fit = inlet ? table[inlet.connector.toUpperCase()] : undefined
    if (inlet && outConn && fit) {
      const o = outConn.toUpperCase()
      if (fit.adapter.includes(o)) out.push({ code: 'RCD-PWR-CONNECTOR', severity: 'warning', message: `"${rd.label}" ${inlet.id} (${inlet.connector}) on ${pdu.id} outlet ${l.outlet} (${outConn}) needs a hybrid cord (${outConn} outlet to ${inlet.connector} inlet); prefer a ${fit.ok.join('/')} outlet.`, path })
      else if (!fit.ok.includes(o)) out.push({ code: 'RCD-PWR-CONNECTOR', severity: 'error', message: `"${rd.label}" ${inlet.id} (${inlet.connector}) cannot be fed from ${pdu.id} outlet ${l.outlet} (${outConn}).`, path })
    }

    if (rd.device.rack && rd.device.rack !== pdu.rack) {
      out.push({ code: 'RCD-PWR-RACK', severity: 'warning', message: `"${rd.label}" in rack "${rd.device.rack}" is fed from PDU "${pdu.id}" in rack "${pdu.rack}".`, path })
    }
  })

  for (const d of report.devices) {
    const rd = ix.devices.get(d.id)!
    const path = `devices[${rd.index}]`
    const cat = rd.type?.category
    if (!cat || !POWERED.includes(cat)) continue
    if (rd.device.status === 'remove') continue
    const inlets = rd.type?.power?.inlets ?? []

    if (!d.hasData) out.push({ code: 'RCD-PWR-DATA', severity: 'warning', message: `"${rd.label}" (${rd.device.type}) has no power figures; its load is counted as 0 W (INCONCLUSIVE).`, path })

    if (d.connected.length === 0) {
      out.push({ code: 'RCD-PWR-UNPOWERED', severity: 'warning', message: `"${rd.label}" has no power links.`, path })
      continue
    }
    const missing = inlets.filter((x) => !d.connected.some((c) => c.inlet === x.id))
    if (missing.length > 0) out.push({ code: 'RCD-PWR-UNPOWERED', severity: 'warning', message: `"${rd.label}": ${missing.map((x) => x.id).join(', ')} not connected.`, path })

    const feeds = new Set(d.connected.map((c) => c.feed))
    if (d.connected.length >= 2 && feeds.size === 1) {
      out.push({ code: 'RCD-PWR-REDUNDANCY', severity: 'warning', message: `"${rd.label}": all inlets are on feed ${[...feeds][0]}; losing that feed drops the device. Spread inlets across feeds.`, path })
    } else if (policy.requireRedundantPower && feeds.size < 2) {
      out.push({ code: 'RCD-PWR-REDUNDANCY', severity: 'warning', message: `"${rd.label}" is single-fed but the policy requires redundant power (add a second PSU, or an ATS upstream — ATS units are not modeled, document it in notes).`, path })
    }
  }

  for (const p of report.pdus) {
    const path = `pdus[${(ix.model.pdus ?? []).indexOf(p.pdu)}]`
    const pct = (w: number): string => `${Math.round((w / p.capacityW) * 100)}%`
    if (p.normalW > p.usableW) {
      out.push({ code: 'RCD-PWR-CAPACITY', severity: 'error', message: `PDU "${p.pdu.id}" normal load ${Math.round(p.normalW)} W (${pct(p.normalW)}) exceeds the usable ${Math.round(p.usableW)} W (${Math.round(report.derating * 100)}% of ${Math.round(p.capacityW)} W).`, path })
    }
    if (p.failoverFeed && p.failoverW > p.usableW) {
      out.push({ code: 'RCD-PWR-FAILOVER', severity: 'error', message: `If feed ${p.failoverFeed} fails, PDU "${p.pdu.id}" carries ${Math.round(p.failoverW)} W (${pct(p.failoverW)}), above the usable ${Math.round(p.usableW)} W.`, path })
    }
  }

  if (policy.requireRedundantPower && report.feeds.length < 2 && ix.pdus.size > 0) {
    out.push({ code: 'RCD-PWR-REDUNDANCY', severity: 'warning', message: `Policy requires redundant power but all PDUs are on a single feed (${report.feeds.join(', ')}).`, path: 'pdus' })
  }
}
