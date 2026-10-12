// Cabling rules: ports, sides, reuse, media/connector fit, speed support, reach and the
// copper channel model (90 m permanent link + 10 m cords).

import { mediaData, type MediaInfo } from '../assets.ts'
import type { Channel, Adjacency } from '../channels.ts'
import { nodeKey, normalizeEnd } from '../channels.ts'
import type { Diagnostic, PortConnector, Speed } from '../model.ts'
import { findPort, type Index, type ResolvedPort } from '../resolve.ts'

const SFP_CAGES: PortConnector[] = ['sfp', 'sfp+', 'sfp28']
const QSFP_CAGES: PortConnector[] = ['qsfp+', 'qsfp28']
const CAGES = [...SFP_CAGES, ...QSFP_CAGES]
const FIBER_CONNECTORS: PortConnector[] = ['lc-duplex', 'sc-duplex', 'mpo-12', 'mpo-24']

export function connectorAt(port: ResolvedPort, passive: boolean, side: 'front' | 'rear'): PortConnector {
  return passive && side === 'rear' ? (port.rearConnector ?? port.connector) : port.connector
}

/** null = fits; otherwise [severity, reason] */
export function mediaFit(connector: PortConnector, family: MediaInfo['family']): ['error' | 'warning', string] | null {
  if (family === 'copper') {
    if (connector === 'rj45' || connector === 'punchdown') return null
    if (connector === 'sfp' || connector === 'sfp+') return ['warning', `needs a BASE-T ${connector.toUpperCase()} module (check power, heat and reach limits of copper modules)`]
    return ['error', `${connector} does not accept twisted-pair copper`]
  }
  if (family === 'fiber-mm' || family === 'fiber-sm') {
    if (FIBER_CONNECTORS.includes(connector) || CAGES.includes(connector)) return null
    return ['error', `${connector} does not accept fiber`]
  }
  if (CAGES.includes(connector)) return null
  return ['error', `direct-attach cables plug into SFP/QSFP cages, not ${connector}`]
}

export function checkCabling(ix: Index, adj: Adjacency, channels: Channel[], out: Diagnostic[]): void {
  const md = mediaData()

  ix.cables.forEach((c, i) => {
    const path = `cables[${i}]`
    const info = md.media[c.media]
    const a = normalizeEnd(ix, c.a)
    const b = normalizeEnd(ix, c.b)
    if (nodeKey(a) === nodeKey(b)) out.push({ code: 'RCD-CBL-SELF', severity: 'error', message: `Cable "${c.id}" connects a port to itself.`, path })

    const conn: (PortConnector | undefined)[] = []
    const speeds: (Speed | undefined)[] = []
    for (const [end, node] of [['a', c.a], ['b', c.b]] as const) {
      const rd = ix.devices.get(node.device)
      if (!rd) { conn.push(undefined); speeds.push(undefined); continue }
      if (!rd.passive && node.side === 'rear') out.push({ code: 'RCD-CBL-SIDE', severity: 'error', message: `Cable "${c.id}" end ${end.toUpperCase()}: "side" applies only to patch panels and outlets; "${rd.label}" is ${rd.type?.category ?? 'unknown'}.`, path: `${path}.${end}.side` })
      if (!rd.type) { conn.push(undefined); speeds.push(undefined); continue }
      const port = findPort(rd, node.port)
      if (!port) {
        const names = [...rd.ports.keys()]
        const hint = names.length ? ` Available: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ', …' : ''}.` : ' The equipment type declares no ports.'
        out.push({ code: 'RCD-CBL-PORT', severity: 'error', message: `Cable "${c.id}" end ${end.toUpperCase()}: "${rd.label}" has no port "${node.port}".${hint}`, path: `${path}.${end}.port` })
        conn.push(undefined); speeds.push(undefined)
        continue
      }
      const side = rd.passive ? (node.side ?? 'front') : 'front'
      const connector = connectorAt(port, rd.passive, side)
      conn.push(connector)
      speeds.push(port.speed)
      if (info) {
        const fit = mediaFit(connector, info.family)
        if (fit) out.push({ code: 'RCD-CBL-MEDIA', severity: fit[0], message: `Cable "${c.id}" (${c.media}) at "${rd.label}" ${port.name}: ${fit[1]}.`, path: `${path}.media` })
      }
    }

    if (info?.family === 'direct-attach' && conn[0] && conn[1]) {
      const fam = (x: PortConnector): string => (SFP_CAGES.includes(x) ? 'SFP' : QSFP_CAGES.includes(x) ? 'QSFP' : x)
      if (fam(conn[0]) !== fam(conn[1])) out.push({ code: 'RCD-CBL-MEDIA', severity: 'error', message: `Cable "${c.id}" (${c.media}) joins ${conn[0]} to ${conn[1]}; breakout cables are not modeled, split them into explicit cables per lane group.`, path: `${path}.media` })
    }

    if (c.lengthM === undefined && c.status !== 'remove') {
      out.push({ code: 'RCD-CBL-LENGTH-MISSING', severity: 'warning', message: `Cable "${c.id}" has no lengthM; reach and BOM sizing are INCONCLUSIVE for it.`, path })
    }
  })

  // Port reuse: one cable per port and side.
  for (const [key, list] of adj.byNode) {
    if (list.length < 2) continue
    const [device, port, side] = key.split('\u0000')
    const rd = ix.devices.get(device)
    out.push({ code: 'RCD-CBL-PORT-REUSE', severity: 'error', message: `Port "${port}"${rd?.passive ? ` (${side})` : ''} of "${rd?.label ?? device}" is used by ${list.length} cables: ${list.map((ci) => ix.cables[ci].id).join(', ')}.`, path: `cables[${list[1]}]` })
  }

  for (const ch of channels) checkChannel(ix, ch, out)
}

function checkChannel(ix: Index, ch: Channel, out: Diagnostic[]): void {
  const md = mediaData()
  const path = `cables[${ch.segments[0].cableIndex}]`
  const ids = ch.segments.map((s) => s.cable.id).join(' → ')
  const medias = [...new Set(ch.segments.map((s) => s.cable.media))]
  const infos = medias.map((m) => md.media[m]).filter((x): x is MediaInfo => !!x)
  const families = new Set(infos.map((x) => x.family))

  if (families.has('fiber-mm') && families.has('fiber-sm')) {
    out.push({ code: 'RCD-CBL-MIXED', severity: 'error', message: `Channel ${ids} mixes multimode and single-mode fiber.`, path })
    return
  }
  if (families.size > 1) {
    out.push({ code: 'RCD-CBL-MIXED', severity: 'error', message: `Channel ${ids} mixes media families (${medias.join(', ')}).`, path })
    return
  }
  if (medias.length > 1) out.push({ code: 'RCD-CBL-MIXED', severity: 'warning', message: `Channel ${ids} mixes media grades (${medias.join(', ')}); the lowest grade sets the reach.`, path })

  // Endpoint speed agreement (active ends only)
  const endSpeeds = [ch.start, ch.end].map((n) => {
    const rd = ix.devices.get(n.device)
    return rd && !rd.passive ? findPort(rd, n.port)?.speed : undefined
  })
  if (endSpeeds[0] && endSpeeds[1] && endSpeeds[0] !== endSpeeds[1]) {
    out.push({ code: 'RCD-CBL-SPEED', severity: 'warning', message: `Channel ${ids} joins a ${endSpeeds[0]} port to a ${endSpeeds[1]} port; confirm both sides support ${ch.speed}.`, path })
  }

  const speed = ch.speed
  if (!speed) return
  let limit: { maxM: number; media: string; source: string } | undefined
  for (const m of medias) {
    const r = md.media[m]?.reach[speed]
    if (!r) {
      out.push({ code: 'RCD-CBL-SPEED', severity: 'error', message: `Channel ${ids}: ${m} is not specified for ${speed}.`, path })
      return
    }
    if (!limit || r.maxM < limit.maxM) limit = { maxM: r.maxM, media: m, source: r.source }
  }
  if (limit && ch.totalM !== undefined && ch.totalM > limit.maxM) {
    out.push({ code: 'RCD-CBL-REACH', severity: 'error', message: `Channel ${ids} is ${ch.totalM} m; ${limit.media} at ${speed} reaches ${limit.maxM} m (${limit.source}).`, path })
  }

  if (families.has('copper')) {
    const cm = md.channelModel
    for (const s of ch.segments) {
      if (s.kind === 'permanent' && s.cable.lengthM !== undefined && s.cable.lengthM > cm.copperPermanentLinkMaxM) {
        out.push({ code: 'RCD-CBL-CHANNEL', severity: 'error', message: `Permanent link "${s.cable.id}" is ${s.cable.lengthM} m; the limit is ${cm.copperPermanentLinkMaxM} m (${cm.source}).`, path: `cables[${s.cableIndex}]` })
      }
    }
    if (ch.segments.some((s) => s.kind === 'permanent')) {
      const cords = ch.segments.filter((s) => s.kind === 'cord').reduce((a, s) => a + (s.cable.lengthM ?? 0), 0)
      if (cords > cm.copperCordsTotalMaxM) out.push({ code: 'RCD-CBL-CHANNEL', severity: 'warning', message: `Channel ${ids} uses ${Math.round(cords * 10) / 10} m of cords; the channel model allows ${cm.copperCordsTotalMaxM} m in total.`, path })
    }
  }

  // Parallel optics (SR4) need MPO end to end; LC-duplex panels in the path need different optics.
  const optic = families.has('fiber-mm') ? md.optics['fiber-mm'][speed] : undefined
  if (optic && md.parallelOptics.includes(optic)) {
    const lcPanels = ch.segments.some((s) => [s.from, s.to].some((n) => {
      const rd = ix.devices.get(n.device)
      const p = rd?.passive ? findPort(rd, n.port) : undefined
      return !!p && !!rd && connectorAt(p, true, n.side).endsWith('duplex')
    }))
    if (lcPanels) out.push({ code: 'RCD-CBL-OPTIC', severity: 'warning', message: `Channel ${ids} runs ${optic} (parallel MPO optics) through duplex fiber panels; use MPO panels/cassettes or duplex optics (e.g. BiDi/SWDM).`, path })
  }
}
