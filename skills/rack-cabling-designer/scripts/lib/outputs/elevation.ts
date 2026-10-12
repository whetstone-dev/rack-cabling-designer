// Rack elevation: one self-contained HTML file (inline CSS + SVG, no scripts, no network)
// with front and rear views of every rack. Opens in any browser and prints on A4/Letter.

import { html } from '../escape.ts'
import type { Face } from '../model.ts'
import { facesOf, type Occupant, type RackOccupancy } from '../occupancy.ts'
import type { Analysis } from '../validate.ts'

const U_H = 20
const LABEL_W = 30
const SIDE_W = 14
const BODY_W = 230
const TOP = 26
const WIDTH = LABEL_W + SIDE_W + BODY_W + SIDE_W + 6

const CATEGORIES = ['switch', 'router', 'firewall', 'server', 'storage', 'patch-panel', 'outlet', 'cable-manager', 'blanking', 'shelf', 'ups', 'kvm', 'other', 'pdu']

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

function occupantSvg(o: Occupant, view: Face, rackHeight: number, a: Analysis): string {
  // Clip to the rack: out-of-bounds units are reported as RCD-RACK-BOUNDS, not drawn outside the frame.
  const lo = Math.max(1, o.startU)
  const hi = Math.min(rackHeight, o.startU + o.heightU - 1)
  if (lo > hi) return ''
  const y = TOP + (rackHeight - hi) * U_H
  const h = (hi - lo + 1) * U_H
  const x = LABEL_W + SIDE_W
  const back = o.face !== view
  const rd = o.kind === 'device' ? a.index.devices.get(o.id) : undefined
  const t = rd?.type
  const model = t ? [t.manufacturer, t.model].filter(Boolean).join(' ') : ''
  const tip = [
    `${o.label} (${o.id})`,
    model,
    `U${o.startU}${o.heightU > 1 ? `-U${o.startU + o.heightU - 1}` : ''} · ${o.category}${back ? ' · rear of equipment' : ''}`,
    o.status ? `status: ${o.status}` : '',
    rd?.device.role ? `role: ${rd.device.role}` : '',
  ].filter(Boolean).join('\n')
  const cls = [`c-${CATEGORIES.includes(o.category) ? o.category : 'other'}`, back ? 'back' : '', o.status === 'planned' ? 'planned' : '', o.status === 'remove' ? 'remove' : ''].filter(Boolean).join(' ')
  const text = back ? `${o.label} (rear)` : o.label
  const fontY = y + Math.min(h, U_H) / 2 + 4
  return `<g class="occ ${cls}"><title>${html(tip)}</title>`
    + `<rect x="${x + 2}" y="${y + 1}" width="${BODY_W - 4}" height="${h - 2}" rx="2"/>`
    + `<text x="${x + 8}" y="${fontY}">${html(truncate(text, 34))}</text>`
    + (o.status === 'remove' ? `<line class="x" x1="${x + 2}" y1="${y + 1}" x2="${x + BODY_W - 2}" y2="${y + h - 1}"/>` : '')
    + `</g>`
}

function rackSvg(occ: RackOccupancy, view: Face, a: Analysis): string {
  const H = occ.heightU
  const height = TOP + H * U_H + 8
  const parts: string[] = []
  parts.push(`<text class="view" x="${LABEL_W + SIDE_W}" y="16">${view === 'front' ? 'FRONT' : 'REAR'}</text>`)
  parts.push(`<rect class="frame" x="${LABEL_W}" y="${TOP}" width="${SIDE_W * 2 + BODY_W}" height="${H * U_H}"/>`)
  for (let u = 1; u <= H; u++) {
    const y = TOP + (H - u) * U_H
    parts.push(`<text class="u" x="${LABEL_W - 4}" y="${y + U_H / 2 + 4}">${u}</text>`)
    parts.push(`<line class="grid" x1="${LABEL_W + SIDE_W}" y1="${y}" x2="${LABEL_W + SIDE_W + BODY_W}" y2="${y}"/>`)
  }
  // 0U PDUs in the side channels
  for (const p of occ.sidePdus) {
    const x = p.side === 'left' ? LABEL_W + 2 : LABEL_W + SIDE_W + BODY_W + 2
    parts.push(`<g class="occ c-pdu side"><title>${html(`${p.label} (${p.id}) · 0U ${p.side} · feed ${p.feed}`)}</title><rect x="${x}" y="${TOP + 4}" width="${SIDE_W - 4}" height="${H * U_H - 8}" rx="2"/><text class="feed" x="${x + (SIDE_W - 4) / 2}" y="${TOP + 16}">${html(truncate(p.feed, 2))}</text></g>`)
  }
  for (const o of occ.occupants) {
    if (!facesOf(o).includes(view)) continue
    parts.push(occupantSvg(o, view, H, a))
  }
  // Collisions on this face
  occ.cells.forEach((cell, i) => {
    if (cell[view].length > 1) {
      const y = TOP + (H - (i + 1)) * U_H
      parts.push(`<rect class="clash" x="${LABEL_W + SIDE_W}" y="${y}" width="${BODY_W}" height="${U_H}"><title>${html(`Collision at U${i + 1}: ${cell[view].join(', ')}`)}</title></rect>`)
    }
  })
  return `<svg class="rack" role="img" aria-label="${html(`${occ.rackId} ${view} elevation`)}" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`
}

const CSS = `
:root{--bg:#f6f7f9;--panel:#fff;--ink:#1d2430;--muted:#5d6878;--line:#d5dae1;--frame:#3b4452;--grid:#e6e9ee;
--switch:#2f78c4;--router:#6a5acd;--firewall:#c2413b;--server:#2f8a5b;--storage:#b7791f;--patch-panel:#5f6b7a;--outlet:#5f6b7a;
--cable-manager:#98a2ae;--blanking:#c4cad3;--shelf:#a0896b;--ups:#8e44ad;--kvm:#138d78;--other:#7f8c8d;--pdu:#d06a1c;--clash:#e0245e;--on:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0f1319;--panel:#171c24;--ink:#e6eaf0;--muted:#9aa5b4;--line:#2a313c;--frame:#8c97a6;--grid:#232a34;
--switch:#4f95dc;--router:#8a7cf0;--firewall:#e0605a;--server:#3fab73;--storage:#d29a3a;--patch-panel:#7d8999;--outlet:#7d8999;
--cable-manager:#5d6773;--blanking:#3c444f;--shelf:#8d7a5f;--ups:#a666c4;--kvm:#26a990;--other:#7b8790;--pdu:#e07e30;--on:#0f1319}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,main{max-width:1200px;margin:0 auto;padding:16px}h1{font-size:22px;margin:8px 0 4px}h2{font-size:17px;margin:0 0 4px}
.meta,.note{color:var(--muted);font-size:13px}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.chip{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:13px}
.chip.err{border-color:var(--firewall);color:var(--firewall)}.chip.warn{border-color:var(--storage);color:var(--storage)}
.rackcard{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;margin:16px 0;break-inside:avoid}
.views{display:flex;flex-wrap:wrap;gap:18px;overflow-x:auto}.rack{max-width:100%;height:auto}
.rack text{font-size:11px;fill:var(--ink)}.rack .view{font-weight:600;fill:var(--muted);letter-spacing:.08em}
.rack .u{text-anchor:end;fill:var(--muted);font-size:10px}.rack .frame{fill:none;stroke:var(--frame);stroke-width:2}.rack .grid{stroke:var(--grid)}
.occ rect{stroke:rgba(0,0,0,.25)}.occ text{fill:var(--on);font-weight:600}.occ.back rect{fill-opacity:.35}.occ.back text{fill:var(--ink);font-weight:400}
.occ.planned rect{stroke-dasharray:4 3;stroke:var(--ink)}.occ.remove rect{fill-opacity:.25}.occ .x{stroke:var(--firewall);stroke-width:2}
.side text.feed{text-anchor:middle;font-size:9px}.clash{fill:var(--clash);fill-opacity:.35;stroke:var(--clash);stroke-width:2}
${CATEGORIES.map((c) => `.c-${c} rect{fill:var(--${c})}`).join('')}
.c-blanking text,.c-cable-manager text{fill:var(--ink);font-weight:400}
.legend{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--muted)}.legend span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px;background:var(--c)}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
.sev-error{color:var(--firewall);font-weight:600}.sev-warning{color:var(--storage);font-weight:600}.sev-info{color:var(--muted)}
@media print{body{background:#fff}.rackcard{border:none;page-break-inside:avoid}@page{size:landscape;margin:12mm}}
`

export function renderElevation(a: Analysis): string {
  const m = a.model
  const sections: string[] = []
  for (const rack of a.index.racks.values()) {
    const occ = a.occupancy.get(rack.id)
    if (!occ) continue
    const power = a.power.racks.find((r) => r.rackId === rack.id)
    const kg = occ.occupants.reduce((s, o) => s + (o.kind === 'device' ? (a.index.devices.get(o.id)?.type?.weightKg ?? 0) : (a.index.pdus.get(o.id)?.weightKg ?? 0)), 0)
    const usedFront = occ.cells.filter((c) => c.front.length > 0).length
    const facts = [
      `${rack.heightU}U`,
      rack.widthIn ? `${rack.widthIn}"` : '',
      rack.depthMm ? `${rack.depthMm} mm deep` : '',
      rack.posts ? `${rack.posts}-post` : '',
      `front ${usedFront}/${rack.heightU}U used`,
      `${kg.toFixed(1)}${rack.maxLoadKg ? `/${rack.maxLoadKg}` : ''} kg`,
      power ? `${Math.round(power.loadW)} W (${a.power.basis}) · ${Math.round(power.btuPerHour)} BTU/h` : '',
      `front faces ${rack.frontAisle ?? 'cold'} aisle`,
    ].filter(Boolean).join(' · ')
    sections.push(`<section class="rackcard"><h2>${html(rack.name ?? rack.id)}</h2><p class="meta">${html(rack.location ?? '')}${rack.location ? ' · ' : ''}${html(facts)}</p>`
      + `<div class="views">${rackSvg(occ, 'front', a)}${rackSvg(occ, 'rear', a)}</div></section>`)
  }

  const diag = a.diagnostics.length === 0
    ? '<p class="note">No findings.</p>'
    : `<table><thead><tr><th>Severity</th><th>Code</th><th>Finding</th></tr></thead><tbody>${a.diagnostics.map((d) => `<tr><td class="sev-${d.severity}">${d.severity}</td><td>${html(d.code)}</td><td>${html(d.message)}</td></tr>`).join('')}</tbody></table>`

  const legend = CATEGORIES.map((c) => `<span style="--c:var(--${c})">${c}</span>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${html(m.meta.name)} — rack elevations</title><style>${CSS}</style></head><body>
<header><h1>${html(m.meta.name)}</h1>
<p class="meta">${[m.meta.site, m.meta.revision ? `rev ${m.meta.revision}` : '', m.meta.status].filter(Boolean).map(html).join(' · ')}</p>
<div class="chips"><span class="chip">${a.index.racks.size} rack(s)</span><span class="chip">${m.devices.length} device(s)</span><span class="chip">${a.index.cables.length} cable(s)</span>
<span class="chip ${a.counts.error ? 'err' : ''}">${a.counts.error} error(s)</span><span class="chip ${a.counts.warning ? 'warn' : ''}">${a.counts.warning} warning(s)</span></div>
<div class="legend">${legend}</div>
<p class="note">Planning aid generated from the model. Verify dimensions, weights and power against datasheets and the site before installation. Hover a unit for details.</p></header>
<main>${sections.join('\n')}<section class="rackcard"><h2>Findings</h2>${diag}</section></main></body></html>
`
}
