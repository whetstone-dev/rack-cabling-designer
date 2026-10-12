// Cable schedule (CSV and Markdown) and printable label sheet (CSV), ordered by channel.

import { normalizeEnd, type Segment } from '../channels.ts'
import { csvRow, mdTable } from '../escape.ts'
import { endpointText } from '../resolve.ts'
import type { Analysis } from '../validate.ts'

interface Row {
  channel: string
  cable: string
  label: string
  a: string
  b: string
  media: string
  lengthM: string
  color: string
  fn: string
  kind: string
  pathway: string
  status: string
}

function rows(a: Analysis): Row[] {
  const out: Row[] = []
  for (const ch of a.channels) {
    for (const s of ch.segments) out.push(row(a, ch.id, s))
  }
  return out
}

function row(a: Analysis, channel: string, s: Segment): Row {
  const c = s.cable
  return {
    channel,
    cable: c.id,
    label: c.label ?? '',
    a: endpointText(a.index, s.from.device, s.from.port, s.from.side),
    b: endpointText(a.index, s.to.device, s.to.port, s.to.side),
    media: c.media,
    lengthM: c.lengthM === undefined ? '' : String(c.lengthM),
    color: c.color ?? '',
    fn: c.function ?? '',
    kind: s.kind,
    pathway: c.pathway ?? '',
    status: c.status ?? 'planned',
  }
}

const HEAD = ['Channel', 'Cable', 'Label', 'A end', 'B end', 'Media', 'Length (m)', 'Color', 'Function', 'Kind', 'Pathway', 'Status']
const cells = (r: Row): string[] => [r.channel, r.cable, r.label, r.a, r.b, r.media, r.lengthM, r.color, r.fn, r.kind, r.pathway, r.status]

export function scheduleCsv(a: Analysis): string {
  return [csvRow(HEAD), ...rows(a).map((r) => csvRow(cells(r)))].join('\n') + '\n'
}

export function scheduleMd(a: Analysis): string {
  const channelRows = a.channels.map((ch) => [
    ch.id,
    endpointText(a.index, ch.start.device, ch.start.port, ch.start.side) + (ch.openStart ? ' (open)' : ''),
    endpointText(a.index, ch.end.device, ch.end.port, ch.end.side) + (ch.openEnd ? ' (open)' : ''),
    ch.segments.length,
    ch.totalM ?? 'unknown',
    ch.speed ?? '',
  ])
  return `## Channels\n\n${mdTable(['Channel', 'Start', 'End', 'Cables', 'Total (m)', 'Speed'], channelRows)}\n## Cables\n\n${mdTable(HEAD, rows(a).map(cells))}`
}

/** Two labels per cable (one per end): line 1 is the cable label, line 2 points to the far end. */
export function labelsCsv(a: Analysis): string {
  const out = [csvRow(['Cable', 'End', 'Line 1', 'Line 2', 'Attach at'])]
  for (const ch of a.channels) {
    for (const s of ch.segments) {
      // End A/B follow the cable's own a/b, not the channel direction.
      const id = s.cable.label ?? s.cable.id
      const ea = normalizeEnd(a.index, s.cable.a)
      const eb = normalizeEnd(a.index, s.cable.b)
      const textA = endpointText(a.index, ea.device, ea.port, ea.side)
      const textB = endpointText(a.index, eb.device, eb.port, eb.side)
      out.push(csvRow([s.cable.id, 'A', id, `to ${textB}`, textA]))
      out.push(csvRow([s.cable.id, 'B', id, `to ${textA}`, textB]))
    }
  }
  return out.join('\n') + '\n'
}
