// End-to-end channel tracing. Passive panels and outlets connect port N front to port N rear,
// so a chain of cables through them forms one channel (e.g. switch → cord → panel → horizontal
// cable → outlet). Channels drive reach checks, the cable schedule and the BOM.

import { mediaData } from './assets.ts'
import type { Cable, Face, Speed } from './model.ts'
import { findPort, type Index } from './resolve.ts'

export interface ChannelNode { device: string; port: string; side: Face }

export interface Segment {
  cable: Cable
  cableIndex: number
  from: ChannelNode
  to: ChannelNode
  /** permanent = panel/outlet rear to panel/outlet rear (installed horizontal or backbone cable) */
  kind: 'cord' | 'permanent'
}

export interface Channel {
  id: string
  segments: Segment[]
  start: ChannelNode
  end: ChannelNode
  /** true when an end stops at a passive panel/outlet with nothing patched on the other side */
  openStart: boolean
  openEnd: boolean
  totalM?: number
  speed?: Speed
}

export function nodeKey(n: ChannelNode): string {
  return `${n.device}\u0000${n.port}\u0000${n.side}`
}

/** Normalize an endpoint: canonical port name and side (active devices only have a front). */
export function normalizeEnd(ix: Index, end: Cable['a']): ChannelNode {
  const rd = ix.devices.get(end.device)
  const port = rd ? (findPort(rd, end.port)?.name ?? end.port) : end.port
  const side: Face = rd?.passive ? (end.side ?? 'front') : 'front'
  return { device: end.device, port, side }
}

export interface Adjacency { byNode: Map<string, number[]> }

export function buildAdjacency(ix: Index): Adjacency {
  const byNode = new Map<string, number[]>()
  ix.cables.forEach((c, i) => {
    for (const end of [c.a, c.b]) {
      const k = nodeKey(normalizeEnd(ix, end))
      const list = byNode.get(k) ?? []
      if (!list.includes(i)) list.push(i)
      byNode.set(k, list)
    }
  })
  return { byNode }
}

function speedRank(s: Speed): number {
  return mediaData().speeds.indexOf(s)
}

export function slowest(speeds: (Speed | undefined)[]): Speed | undefined {
  const known = speeds.filter((s): s is Speed => !!s)
  if (known.length === 0) return undefined
  return known.reduce((a, b) => (speedRank(a) <= speedRank(b) ? a : b))
}

export function traceChannels(ix: Index, adj: Adjacency = buildAdjacency(ix)): Channel[] {
  const assigned = new Set<number>()
  const channels: Channel[] = []

  const orient = (ci: number, from: ChannelNode): Segment => {
    const c = ix.cables[ci]
    const a = normalizeEnd(ix, c.a)
    const b = normalizeEnd(ix, c.b)
    const forward = nodeKey(a) === nodeKey(from)
    const seg: Segment = { cable: c, cableIndex: ci, from: forward ? a : b, to: forward ? b : a, kind: 'cord' }
    const fromPassive = ix.devices.get(seg.from.device)?.passive
    const toPassive = ix.devices.get(seg.to.device)?.passive
    if (fromPassive && toPassive && seg.from.side === 'rear' && seg.to.side === 'rear') seg.kind = 'permanent'
    return seg
  }

  /** Follow the chain outward from `node` (the far end of an already-taken cable). */
  const extend = (node: ChannelNode): { segments: Segment[]; end: ChannelNode; open: boolean } => {
    const segments: Segment[] = []
    let current = node
    for (let guard = 0; guard < 1000; guard++) {
      const rd = ix.devices.get(current.device)
      if (!rd?.passive) return { segments, end: current, open: false }
      const mirror: ChannelNode = { ...current, side: current.side === 'front' ? 'rear' : 'front' }
      const next = (adj.byNode.get(nodeKey(mirror)) ?? []).find((ci) => !assigned.has(ci))
      if (next === undefined) return { segments, end: current, open: true }
      assigned.add(next)
      const seg = orient(next, mirror)
      segments.push(seg)
      current = seg.to
    }
    return { segments, end: current, open: true }
  }

  ix.cables.forEach((c, ci) => {
    if (assigned.has(ci)) return
    assigned.add(ci)
    const core = orient(ci, normalizeEnd(ix, c.a))
    const fwd = extend(core.to)
    const back = extend(core.from)
    // back segments run away from the core; flip them so the channel reads start → end
    const before = back.segments.reverse().map((s) => ({ ...s, from: s.to, to: s.from }))
    const segments = [...before, core, ...fwd.segments]
    const lengths = segments.map((s) => s.cable.lengthM)
    const totalM = lengths.every((x) => typeof x === 'number') ? round(lengths.reduce((a, b) => a! + b!, 0)!) : undefined
    const start = segments[0].from
    const end = segments[segments.length - 1].to
    const speeds = [start, end].map((n) => {
      const rd = ix.devices.get(n.device)
      return rd && !rd.passive ? findPort(rd, n.port)?.speed : undefined
    })
    channels.push({ id: `CH${String(channels.length + 1).padStart(3, '0')}`, segments, start, end, openStart: back.open, openEnd: fwd.open, totalM, speed: slowest(speeds) })
  })
  return channels
}

export function round(n: number): number {
  return Math.round(n * 100) / 100
}
