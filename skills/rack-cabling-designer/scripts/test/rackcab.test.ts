// Core tests: schema, every rule family, channels, power math, outputs and the CLI.
// Run from the skill folder: node --test scripts/test/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RackModel } from '../lib/model.ts'
import { analyze, loadModel } from '../lib/validate.ts'
import { expandPortName } from '../lib/resolve.ts'
import { csv, html, md } from '../lib/escape.ts'
import { renderElevation } from '../lib/outputs/elevation.ts'
import { labelsCsv, scheduleCsv } from '../lib/outputs/schedule.ts'
import { computeBom } from '../lib/outputs/bom.ts'
import { documentMd } from '../lib/outputs/reports.ts'
import { pduCapacityW } from '../lib/power.ts'

const SKILL = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EXAMPLES = join(SKILL, 'examples')
const CLI = join(SKILL, 'scripts', 'rackcab.ts')
const example = (n: string): RackModel => loadModel(join(EXAMPLES, n))
const codes = (m: RackModel, severity = 'error'): string[] => analyze(m).diagnostics.filter((d) => d.severity === severity).map((d) => d.code)

/** Minimal valid model; tests add the parts they need. */
function base(): RackModel {
  return {
    modelVersion: 1,
    meta: { name: 'test' },
    racks: [{ id: 'R1', heightU: 42, depthMm: 1000, maxLoadKg: 800, frontAisle: 'cold' }],
    devices: [],
    pdus: [],
    powerLinks: [],
    cables: [],
  }
}

test('examples: healthy ones have no errors, the broken one covers every rule family', () => {
  assert.deepEqual(codes(example('small-office.rack.json')), [])
  assert.deepEqual(codes(example('small-office.rack.json'), 'warning'), [])
  assert.deepEqual(codes(example('datacenter-pod.rack.json')), [])
  const broken = new Set(codes(example('broken-rack.rack.json')))
  for (const c of ['RCD-RACK-BOUNDS', 'RCD-RACK-OVERLAP', 'RCD-RACK-DEPTH', 'RCD-RACK-WEIGHT', 'RCD-AIR-RECIRC', 'RCD-PWR-OUTLET', 'RCD-PWR-CONNECTOR', 'RCD-PWR-CAPACITY', 'RCD-CBL-MEDIA', 'RCD-CBL-PORT', 'RCD-CBL-PORT-REUSE', 'RCD-CBL-SPEED', 'RCD-CBL-CHANNEL', 'RCD-CBL-REACH', 'RCD-LBL-DUP']) {
    assert.ok(broken.has(c), `broken example should report ${c}`)
  }
})

test('schema: unknown fields, wrong types and enums are reported and stop domain rules', () => {
  const m = base() as unknown as Record<string, unknown>
  ;(m.racks as Record<string, unknown>[])[0].heigthU = 42
  ;(m.racks as Record<string, unknown>[])[0].posts = 3
  const a = analyze(m as unknown as RackModel)
  assert.ok(a.diagnostics.every((d) => d.code === 'RCD-SCHEMA'))
  assert.ok(a.diagnostics.some((d) => d.message.includes('unknown field "heigthU"') && d.message.includes('heightU')))
  assert.ok(a.diagnostics.some((d) => d.message.includes('not allowed')))
})

test('ports: ranges expand and refuse absurd sizes', () => {
  assert.deepEqual(expandPortName('Gi1/0/{1-3}'), ['Gi1/0/1', 'Gi1/0/2', 'Gi1/0/3'])
  assert.deepEqual(expandPortName('mgmt0'), ['mgmt0'])
  assert.throws(() => expandPortName('p{1-100000}'))
  assert.throws(() => expandPortName('p{5-1}'))
})

test('integrity: duplicate ids and unknown references', () => {
  const m = base()
  m.devices.push({ id: 'x', type: 'generic-server-1u', rack: 'R1', position: 1 }, { id: 'x', type: 'nope', rack: 'R9', position: 3 })
  const c = codes(m)
  assert.ok(c.includes('RCD-DUP-ID'))
  assert.ok(c.filter((x) => x === 'RCD-REF').length >= 2)
})

test('rack: half-depth front and rear share a unit; full depth does not', () => {
  const m = base()
  m.devices.push(
    { id: 'pp', type: 'generic-patch-panel-24-rj45', rack: 'R1', position: 40, face: 'front' },
    { id: 'cm', type: 'generic-cable-manager-1u', rack: 'R1', position: 40, face: 'rear' },
  )
  assert.deepEqual(codes(m), [])
  m.devices.push({ id: 'srv', type: 'generic-server-1u', rack: 'R1', position: 40 })
  assert.ok(codes(m).includes('RCD-RACK-OVERLAP'))
})

test('rack: 2U device occupies position and position+1; bounds use the top unit', () => {
  const m = base()
  m.racks[0].heightU = 10
  m.devices.push({ id: 's', type: 'generic-server-2u', rack: 'R1', position: 10 })
  assert.ok(codes(m).includes('RCD-RACK-BOUNDS'))
  m.devices[0].position = 9
  assert.ok(!codes(m).includes('RCD-RACK-BOUNDS'))
})

test('airflow: port-side-exhaust switch facing rear is fine; front-to-back facing rear recirculates', () => {
  const pod = example('datacenter-pod.rack.json')
  assert.ok(!codes(pod).includes('RCD-AIR-RECIRC'))
  const m = base()
  m.devices.push({ id: 'leaf', type: 'generic-leaf-48-25g-6-100g', rack: 'R1', position: 42, face: 'rear' })
  assert.ok(codes(m).includes('RCD-AIR-RECIRC'))
  m.racks[0].frontAisle = 'none'
  assert.ok(!codes(m).includes('RCD-AIR-RECIRC'))
})

test('power: capacity formulas and A/B failover', () => {
  assert.equal(pduCapacityW({ id: 'p', rack: 'R1', feed: 'A', voltage: 230, maxAmps: 16, outlets: [] }), 3680)
  assert.equal(Math.round(pduCapacityW({ id: 'p', rack: 'R1', feed: 'A', voltage: 400, maxAmps: 16, phases: 3, outlets: [] })), 11085)

  const m = base()
  m.pdus = [
    { id: 'a', rack: 'R1', feed: 'A', voltage: 230, maxAmps: 10, outlets: [{ connector: 'C13', count: 10 }] },
    { id: 'b', rack: 'R1', feed: 'B', voltage: 230, maxAmps: 10, outlets: [{ connector: 'C13', count: 10 }] },
  ]
  // 2 servers x 1100 W = 2200 W: 1100 W per PDU normally (60% of 1840 usable), 2200 W on failover (> 1840)
  for (const [i, id] of ['s1', 's2'].entries()) {
    m.devices.push({ id, type: 'generic-server-2u', rack: 'R1', position: 1 + i * 2 })
    m.powerLinks!.push({ device: id, inlet: 'PSU1', pdu: 'a', outlet: i + 1 }, { device: id, inlet: 'PSU2', pdu: 'b', outlet: i + 1 })
  }
  const a = analyze(m)
  const pa = a.power.pdus.find((p) => p.pdu.id === 'a')!
  assert.equal(Math.round(pa.normalW), 1100)
  assert.equal(Math.round(pa.failoverW), 2200)
  assert.equal(pa.failoverFeed, 'B')
  assert.ok(codes(m).includes('RCD-PWR-FAILOVER'))
  assert.ok(!codes(m).includes('RCD-PWR-CAPACITY'))
  m.policy = { powerBasis: 'typical' } // 450 W each → 900 W failover
  assert.ok(!codes(m).includes('RCD-PWR-FAILOVER'))
})

test('power: connector fit, outlet reuse and same-feed redundancy', () => {
  const m = base()
  m.equipmentTypes = [{ id: 'big', category: 'server', heightU: 1, power: { maxW: 100, inlets: [{ id: 'PSU1', connector: 'C20' }, { id: 'PSU2', connector: 'C14' }] } }]
  m.pdus = [{ id: 'a', rack: 'R1', feed: 'A', voltage: 230, maxAmps: 16, outlets: [{ connector: 'C13', count: 2 }, { connector: 'C19', count: 2 }] }]
  m.devices.push({ id: 'd', type: 'big', rack: 'R1', position: 1 })
  m.powerLinks = [{ device: 'd', inlet: 'PSU1', pdu: 'a', outlet: 1 }, { device: 'd', inlet: 'PSU2', pdu: 'a', outlet: 3 }]
  const a = analyze(m)
  assert.ok(a.diagnostics.some((d) => d.code === 'RCD-PWR-CONNECTOR' && d.severity === 'error')) // C20 on C13
  assert.ok(a.diagnostics.some((d) => d.code === 'RCD-PWR-CONNECTOR' && d.severity === 'warning')) // C14 on C19
  assert.ok(a.diagnostics.some((d) => d.code === 'RCD-PWR-REDUNDANCY'))
  m.powerLinks.push({ device: 'd', inlet: 'PSU2', pdu: 'a', outlet: 1 })
  const c = codes(m)
  assert.ok(c.includes('RCD-PWR-OUTLET') && c.includes('RCD-PWR-INLET'))
})

test('channels: chain through panels, permanent link limit and open ends', () => {
  const office = analyze(example('small-office.rack.json'))
  const ch = office.channels.find((c) => c.segments.some((s) => s.cable.id === 'h3'))!
  assert.equal(ch.segments.length, 2)
  assert.equal(ch.totalM, 42.5)
  assert.equal(ch.speed, '1G')
  assert.ok(ch.openEnd || ch.openStart)
  assert.equal(ch.segments.find((s) => s.cable.id === 'h3')!.kind, 'permanent')

  const pod = analyze(example('datacenter-pod.rack.json'))
  const uplink = pod.channels.find((c) => c.segments.some((s) => s.cable.id === 'f02'))!
  assert.deepEqual(uplink.segments.map((s) => s.cable.id).sort(), ['f01', 'f02', 'f03'])
  assert.equal(uplink.totalM, 19)
  assert.equal(uplink.speed, '100G')
})

test('cabling: reach by speed and media, mixed fiber, SR4 through LC panels', () => {
  const m = base()
  m.devices.push(
    { id: 's1', type: 'generic-spine-32-100g', rack: 'R1', position: 42 },
    { id: 's2', type: 'generic-spine-32-100g', rack: 'R1', position: 40 },
    { id: 'f1', type: 'generic-fiber-panel-24-lc', rack: 'R1', position: 38 },
    { id: 'f2', type: 'generic-fiber-panel-24-lc', rack: 'R1', position: 37 },
  )
  m.cables = [
    { id: 'a', label: 'L1', a: { device: 's1', port: 'Eth1/1' }, b: { device: 'f1', port: '1' }, media: 'om4', lengthM: 3 },
    { id: 'b', label: 'L2', a: { device: 'f1', port: '1', side: 'rear' }, b: { device: 'f2', port: '1', side: 'rear' }, media: 'om4', lengthM: 120 },
    { id: 'c', label: 'L3', a: { device: 'f2', port: '1' }, b: { device: 's2', port: 'Eth1/1' }, media: 'om4', lengthM: 3 },
  ]
  let a = analyze(m)
  assert.ok(a.diagnostics.some((d) => d.code === 'RCD-CBL-REACH')) // 126 m > 100 m for 100G on OM4
  assert.ok(a.diagnostics.some((d) => d.code === 'RCD-CBL-OPTIC'))
  m.cables[1].lengthM = 50
  m.cables[1].media = 'os2'
  a = analyze(m)
  assert.ok(a.diagnostics.some((d) => d.code === 'RCD-CBL-MIXED' && d.severity === 'error'))
})

test('labels: duplicates, pattern and color code', () => {
  const m = example('small-office.rack.json')
  m.cables![1].label = 'C-001'
  m.cables![2].label = 'bad label'
  m.cables![4].color = 'red'
  const a = analyze(m)
  const c = a.diagnostics.map((d) => d.code)
  assert.ok(c.includes('RCD-LBL-DUP') && c.includes('RCD-LBL-PATTERN') && c.includes('RCD-LBL-COLOR'))
})

test('escaping: HTML, Markdown and CSV formula injection', () => {
  assert.equal(html('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;')
  assert.equal(md('a|b\n<script>'), 'a\\|b &lt;script&gt;')
  assert.equal(csv('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csv('-5'), '-5')
  assert.equal(csv('@cmd'), "'@cmd")
})

test('outputs: hostile names are escaped everywhere and the elevation has no scripts', () => {
  const m = example('small-office.rack.json')
  m.meta.name = '<script>alert(1)</script>'
  m.devices[2].name = '"><svg onload=alert(1)>'
  m.cables![4].label = '=cmd|calc'
  m.policy!.labelPattern = '.*'
  const a = analyze(m)
  const page = renderElevation(a)
  assert.ok(!/<script/i.test(page))
  assert.ok(!page.includes('<svg onload'))
  assert.ok(page.includes('Content-Security-Policy'))
  assert.ok(!documentMd(a).includes('<script>'))
  assert.ok(scheduleCsv(a).includes("'=cmd|calc"))
  assert.ok(labelsCsv(a).split('\n').length > 2)
})

test('elevation: out-of-bounds equipment is clipped to the rack frame', () => {
  const page = renderElevation(analyze(example('broken-rack.rack.json')))
  const ys = [...page.matchAll(/<g class="occ [^"]*"><title>[^<]*<\/title><rect x="\d+" y="(-?\d+)"/g)].map((m) => Number(m[1]))
  assert.ok(ys.length > 0)
  assert.ok(ys.every((y) => y >= 26), `rects above the frame: ${ys.filter((y) => y < 26)}`)
})

test('bom: stock lengths, bulk cable with slack, transceivers and blanking panels', () => {
  const pod = analyze(example('datacenter-pod.rack.json'))
  const bom = computeBom(pod)
  const optics = bom.find((l) => l.group === 'Transceivers' && l.item.startsWith('100GBASE-LR4'))
  assert.equal(optics?.quantity, 4)
  const bulk = bom.find((l) => l.group === 'Bulk cable')
  assert.equal(bulk?.quantity, 34) // 2 x ceil(15 m x 1.10)
  assert.ok(bom.some((l) => l.group === 'Rack accessories' && l.quantity === 74))
  const dac = bom.find((l) => l.item.startsWith('DAC 2 m'))
  assert.equal(dac?.quantity, 8)
})

function cli(args: string[], cwd = tmpdir()): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}

test('cli: exit codes, json output, build gate and init', () => {
  assert.equal(cli(['validate', join(EXAMPLES, 'small-office.rack.json')]).status, 0)
  assert.equal(cli(['validate', join(EXAMPLES, 'broken-rack.rack.json')]).status, 1)
  assert.equal(cli(['validate', join(EXAMPLES, 'missing.rack.json')]).status, 2)
  assert.equal(cli(['frobnicate']).status, 2)
  const json = JSON.parse(cli(['validate', join(EXAMPLES, 'datacenter-pod.rack.json'), '--json']).out)
  assert.equal(json.ok, true)
  assert.equal(json.counts.error, 0)

  const dir = mkdtempSync(join(tmpdir(), 'rackcab-'))
  assert.equal(cli(['build', join(EXAMPLES, 'broken-rack.rack.json'), '-o', join(dir, 'b')]).status, 1)
  assert.ok(!existsSync(join(dir, 'b', 'elevation.html')))
  assert.equal(cli(['build', join(EXAMPLES, 'datacenter-pod.rack.json'), '-o', join(dir, 'ok')]).status, 0)
  for (const f of ['elevation.html', 'README.md', 'cable-schedule.csv', 'labels.csv', 'bom.csv', 'power.md', 'report.json']) assert.ok(existsSync(join(dir, 'ok', f)), f)

  const model = join(dir, 'new.rack.json')
  assert.equal(cli(['init', model]).status, 0)
  assert.equal(cli(['init', model]).status, 2) // refuses to overwrite
  assert.match(readFileSync(model, 'utf8'), /"\$schema": "file:/)
  assert.equal(cli(['validate', model]).status, 0)
  assert.match(cli(['trace', join(EXAMPLES, 'datacenter-pod.rack.json'), 'leaf1:Eth1/49']).out, /3 cable\(s\) · 19 m/)
})
