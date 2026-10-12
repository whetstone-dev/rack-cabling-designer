// Shape of src/generated/stage.json, written by scripts/build-examples.ts from the skill's own analysis.
// Shared by the build script (type-only import) and the interactive rack.

export type Severity = 'error' | 'warning' | 'info';

export interface StageUnit {
  id: string;
  label: string;
  kind: 'device' | 'pdu';
  category: string;
  model?: string;
  startU: number;
  heightU: number;
  face: 'front' | 'rear';
  fullDepth: boolean;
  role?: string;
  weightKg?: number;
  loadW?: number;
  airflow?: string;
  /** Worst severity among the findings that mention this unit */
  severity?: Severity;
}

export interface StageRack {
  id: string;
  name: string;
  heightU: number;
  depthMm?: number;
  frontAisle?: string;
  units: StageUnit[];
  sidePdus: { id: string; label: string; side: 'left' | 'right'; feed: string }[];
  loadW: number;
  btu: number;
}

export interface StageFinding {
  code: string;
  severity: Severity;
  message: string;
  /** Units (devices or PDUs) the finding is about */
  units: string[];
  /** Racks the finding is about as a whole (weight, blanking…) */
  racks: string[];
}

export interface StageExample {
  name: string;
  title: string;
  site?: string;
  status?: string;
  racks: StageRack[];
  findings: StageFinding[];
  counts: { error: number; warning: number; info: number };
  totals: { racks: number; devices: number; cables: number; channels: number };
}

export interface StageData {
  examples: StageExample[];
  /** Findings for a copy of the small office model with a typo (the schema rule in action) */
  schemaSample: StageFinding[];
  ruleFamilies: number;
}
