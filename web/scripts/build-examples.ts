// Generates everything the site shows from the skill's real examples, using the skill's own code:
//  - public/examples/<name>/  the real `rackcab build` outputs (elevation.html, README.md, CSVs, power.md, report.json)
//  - public/schemas/rack-model-1.schema.json  the JSON Schema at the URL its $id declares
//  - public/og.png  the repository's social preview, for link cards
//  - src/generated/stage.json  compact data for the interactive rack (occupancy, findings, power, counts)
// Nothing here re-implements a rule: occupancy, power and findings come from scripts/lib.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, loadModel, type Analysis } from '../../skills/rack-cabling-designer/scripts/lib/validate.ts';
import type { Severity, StageData, StageExample, StageFinding, StageRack, StageUnit } from '../src/lib/stage.ts';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(WEB, '..', 'skills', 'rack-cabling-designer');
const RACKCAB = join(SKILL, 'scripts', 'rackcab.ts');
const EXAMPLES = ['small-office', 'datacenter-pod', 'broken-rack'] as const;

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

function worst(a: Severity | undefined, b: Severity): Severity {
  return a === undefined || SEVERITY_ORDER[b] < SEVERITY_ORDER[a] ? b : a;
}

// A finding names its subjects by model path (devices[3], pdus[0], racks[0]) and by "quoted" ids or names in the message
function subjectsOf(d: Analysis['diagnostics'][number], a: Analysis): { units: string[]; racks: string[] } {
  const ids = new Set<string>();
  const racks = new Set<string>();
  const byRackPath = /^racks\[(\d+)\]/.exec(d.path ?? '');
  if (byRackPath) {
    const rack = a.model.racks[Number(byRackPath[1])];
    if (rack) racks.add(rack.id);
  }
  const byPath = /^(devices|pdus)\[(\d+)\]/.exec(d.path ?? '');
  if (byPath) {
    const list = byPath[1] === 'devices' ? a.model.devices : (a.model.pdus ?? []);
    const item = list[Number(byPath[2])];
    if (item) ids.add(item.id);
  }
  const names = new Map<string, string>();
  for (const rd of a.index.devices.values()) {
    names.set(rd.device.id, rd.device.id);
    names.set(rd.label, rd.device.id);
  }
  for (const p of a.index.pdus.values()) {
    names.set(p.id, p.id);
    if (p.name) names.set(p.name, p.id);
  }
  const rackNames = new Map<string, string>();
  for (const r of a.index.racks.values()) {
    rackNames.set(r.id, r.id);
    if (r.name) rackNames.set(r.name, r.id);
  }
  for (const m of d.message.matchAll(/"([^"]+)"/g)) {
    const id = names.get(m[1]);
    if (id) ids.add(id);
    const rackId = rackNames.get(m[1]);
    if (rackId && !id) racks.add(rackId);
  }
  return { units: [...ids], racks: [...racks] };
}

function stageFor(name: string, a: Analysis): StageExample {
  const findings: StageFinding[] = a.diagnostics.map((d) => ({ code: d.code, severity: d.severity, message: d.message, ...subjectsOf(d, a) }));
  const severityById = new Map<string, Severity>();
  for (const f of findings) for (const id of f.units) severityById.set(id, worst(severityById.get(id), f.severity));
  const loadById = new Map(a.power.devices.map((d) => [d.id, d.hasData ? d.loadW : undefined]));
  const rackLoad = new Map(a.power.racks.map((r) => [r.rackId, r]));

  const racks: StageRack[] = [...a.index.racks.values()].map((rack) => {
    const occ = a.occupancy.get(rack.id);
    const units: StageUnit[] = (occ?.occupants ?? []).map((o) => {
      const rd = o.kind === 'device' ? a.index.devices.get(o.id) : undefined;
      const t = rd?.type;
      return {
        id: o.id,
        label: o.label,
        kind: o.kind,
        category: o.category,
        model: t ? [t.manufacturer, t.model].filter(Boolean).join(' ') : undefined,
        startU: o.startU,
        heightU: o.heightU,
        face: o.face,
        fullDepth: o.fullDepth,
        role: rd?.device.role,
        weightKg: t?.weightKg,
        loadW: loadById.get(o.id),
        airflow: t?.airflow,
        severity: severityById.get(o.id),
      };
    });
    return {
      id: rack.id,
      name: rack.name ?? rack.id,
      heightU: rack.heightU,
      depthMm: rack.depthMm,
      frontAisle: rack.frontAisle,
      units,
      sidePdus: occ?.sidePdus ?? [],
      loadW: rackLoad.get(rack.id)?.loadW ?? 0,
      btu: rackLoad.get(rack.id)?.btuPerHour ?? 0,
    };
  });

  return {
    name,
    title: a.model.meta.name,
    site: a.model.meta.site,
    status: a.model.meta.status,
    racks,
    findings,
    counts: a.counts,
    totals: { racks: racks.length, devices: a.model.devices.length, cables: (a.model.cables ?? []).length, channels: a.channels.length },
  };
}

// The real CLI writes the downloadable outputs; the broken example is built as a draft on purpose
function buildOutputs(name: string, outDir: string): void {
  const args = [RACKCAB, 'build', join(SKILL, 'examples', `${name}.rack.json`), '-o', outDir];
  if (name === 'broken-rack') args.push('--allow-invalid');
  const run = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const expected = name === 'broken-rack' ? 1 : 0;
  if (run.status !== expected) {
    throw new Error(`rackcab build ${name} exited with ${run.status} (expected ${expected}):\n${run.stdout}${run.stderr}`);
  }
}

function main(): void {
  const publicExamples = join(WEB, 'public', 'examples');
  const publicSchemas = join(WEB, 'public', 'schemas');
  const generated = join(WEB, 'src', 'generated');
  rmSync(publicExamples, { recursive: true, force: true });
  rmSync(publicSchemas, { recursive: true, force: true });
  mkdirSync(publicSchemas, { recursive: true });
  mkdirSync(generated, { recursive: true });

  const stages: StageExample[] = [];
  for (const name of EXAMPLES) {
    const model = loadModel(join(SKILL, 'examples', `${name}.rack.json`));
    stages.push(stageFor(name, analyze(model)));
    const out = join(publicExamples, name);
    buildOutputs(name, out);
    // The model itself, so visitors can download what produced the outputs
    cpSync(join(SKILL, 'examples', `${name}.rack.json`), join(out, `${name}.rack.json`));
  }

  cpSync(join(SKILL, 'assets', 'schema', 'rack-model.schema.json'), join(publicSchemas, 'rack-model-1.schema.json'));
  // Open Graph image: the repository's social preview
  cpSync(join(WEB, '..', 'docs', 'assets', 'social-preview.png'), join(WEB, 'public', 'og.png'));

  // A real schema finding for the "model integrity" card: the small office model with a typo in one field
  const typo = loadModel(join(SKILL, 'examples', 'small-office.rack.json'));
  const rack = typo.racks[0] as unknown as Record<string, unknown>;
  rack.heigthU = rack.heightU;
  delete rack.heightU;
  const schemaSample: StageFinding[] = analyze(typo).diagnostics.map((d) => ({ code: d.code, severity: d.severity, message: d.message, units: [], racks: [] }));

  const ruleFiles = readdirSync(join(SKILL, 'scripts', 'lib', 'rules')).filter((f) => f.endsWith('.ts'));
  const data: StageData = { examples: stages, schemaSample, ruleFamilies: ruleFiles.length };
  writeFileSync(join(generated, 'stage.json'), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`Examples built: ${EXAMPLES.join(', ')} → public/examples/ · stage data → src/generated/stage.json`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
