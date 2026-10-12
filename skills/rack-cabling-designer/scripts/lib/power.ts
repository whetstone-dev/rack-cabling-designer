// Power budget: PDU capacity, normal load and worst single-feed failure load.
// Load-sharing model: a device's load is split evenly across its connected inlets;
// when a feed is lost the surviving inlets carry the whole load.

import { powerData } from './assets.ts'
import type { Pdu } from './model.ts'
import type { Index } from './resolve.ts'

export interface DeviceLoad {
  id: string
  label: string
  rack?: string
  loadW: number
  hasData: boolean
  connected: { inlet: string; pdu: string; feed: string }[]
}

export interface PduLoad {
  pdu: Pdu
  capacityW: number
  usableW: number
  normalW: number
  failoverW: number
  /** feed whose loss produces failoverW */
  failoverFeed?: string
  outletsUsed: number
  outletsTotal: number
}

export interface PowerReport {
  derating: number
  basis: 'max' | 'typical'
  feeds: string[]
  devices: DeviceLoad[]
  pdus: PduLoad[]
  racks: { rackId: string; loadW: number; btuPerHour: number }[]
}

export function pduCapacityW(p: Pdu): number {
  return p.phases === 3 ? Math.sqrt(3) * p.voltage * p.maxAmps : p.voltage * p.maxAmps
}

export function computePower(ix: Index): PowerReport {
  const data = powerData()
  const policy = ix.model.policy ?? {}
  const derating = policy.powerDerating ?? data.defaultDerating
  const basis = policy.powerBasis ?? 'max'
  const links = ix.model.powerLinks ?? []

  const devices: DeviceLoad[] = []
  for (const rd of ix.devices.values()) {
    const p = rd.type?.power
    const value = basis === 'max' ? (p?.maxW ?? p?.typicalW) : (p?.typicalW ?? p?.maxW)
    const connected = links
      .filter((l) => l.device === rd.device.id && ix.pdus.has(l.pdu))
      .map((l) => ({ inlet: l.inlet, pdu: l.pdu, feed: ix.pdus.get(l.pdu)!.feed }))
    devices.push({ id: rd.device.id, label: rd.label, rack: rd.device.rack, loadW: value ?? 0, hasData: value !== undefined, connected })
  }

  const feeds = [...new Set([...ix.pdus.values()].map((p) => p.feed))].sort()

  /** Load per PDU when `lostFeed` is down (undefined = normal operation). */
  const loadByPdu = (lostFeed?: string): Map<string, number> => {
    const acc = new Map<string, number>()
    for (const d of devices) {
      const alive = d.connected.filter((c) => c.feed !== lostFeed)
      if (alive.length === 0) continue
      for (const c of alive) acc.set(c.pdu, (acc.get(c.pdu) ?? 0) + d.loadW / alive.length)
    }
    return acc
  }

  const normal = loadByPdu()
  const scenarios = feeds.map((f) => ({ feed: f, load: loadByPdu(f) }))

  const pdus: PduLoad[] = [...ix.pdus.values()].map((pdu) => {
    const capacityW = pduCapacityW(pdu)
    let failoverW = normal.get(pdu.id) ?? 0
    let failoverFeed: string | undefined
    for (const s of scenarios) {
      if (s.feed === pdu.feed) continue
      const w = s.load.get(pdu.id) ?? 0
      if (w > failoverW) { failoverW = w; failoverFeed = s.feed }
    }
    const outletsTotal = pdu.outlets.reduce((a, g) => a + g.count, 0)
    const outletsUsed = new Set(links.filter((l) => l.pdu === pdu.id).map((l) => l.outlet)).size
    return { pdu, capacityW, usableW: capacityW * derating, normalW: normal.get(pdu.id) ?? 0, failoverW, failoverFeed, outletsUsed, outletsTotal }
  })

  const racks = [...ix.racks.keys()].map((rackId) => {
    const loadW = devices.filter((d) => d.rack === rackId).reduce((a, d) => a + d.loadW, 0)
    return { rackId, loadW, btuPerHour: loadW * data.wattsToBtuPerHour }
  })

  return { derating, basis, feeds, devices, pdus, racks }
}
