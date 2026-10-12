// Types for the *.rack.json model (assets/schema/rack-model.schema.json) and validation results.

export type Speed = '100M' | '1G' | '2.5G' | '5G' | '10G' | '25G' | '40G' | '100G'
export type Media = 'cat5e' | 'cat6' | 'cat6a' | 'cat8' | 'om1' | 'om2' | 'om3' | 'om4' | 'om5' | 'os2' | 'dac' | 'aoc'
export type PortConnector = 'rj45' | 'lc-duplex' | 'sc-duplex' | 'mpo-12' | 'mpo-24' | 'sfp' | 'sfp+' | 'sfp28' | 'qsfp+' | 'qsfp28' | 'punchdown'
export type Face = 'front' | 'rear'
export type Status = 'planned' | 'existing' | 'remove'
export type Category = 'switch' | 'router' | 'firewall' | 'server' | 'storage' | 'patch-panel' | 'outlet' | 'cable-manager' | 'blanking' | 'shelf' | 'ups' | 'kvm' | 'other'
export type Airflow = 'front-to-back' | 'back-to-front' | 'side-to-side' | 'passive'

export interface Meta {
  name: string
  description?: string
  site?: string
  revision?: string
  status?: 'design' | 'as-built' | 'change'
  author?: string
  language?: string
}

export interface Policy {
  powerDerating?: number
  powerBasis?: 'max' | 'typical'
  requireRedundantPower?: boolean
  requireBlankingPanels?: boolean
  maxRackUtilization?: number
  labelPattern?: string
  colorByFunction?: Record<string, string>
  cableSlackPercent?: number
  stockLengthsM?: number[]
}

export interface Location { id: string; name?: string; kind: string; parent?: string; notes?: string }

export interface Rack {
  id: string
  name?: string
  location?: string
  heightU: number
  widthIn?: 19 | 23
  depthMm?: number
  posts?: 2 | 4
  maxLoadKg?: number
  frontAisle?: 'cold' | 'hot' | 'none'
  notes?: string
}

export interface PortSpec { name: string; connector: PortConnector; rearConnector?: PortConnector; speed?: Speed; role?: string }
export interface InletSpec { id: string; connector: string }

export interface EquipmentType {
  id: string
  manufacturer?: string
  model?: string
  category: Category
  heightU: number
  fullDepth?: boolean
  depthMm?: number
  weightKg?: number
  airflow?: Airflow
  power?: { typicalW?: number; maxW?: number; inlets?: InletSpec[] }
  ports?: PortSpec[]
  notes?: string
}

export interface Device {
  id: string
  name?: string
  type: string
  rack?: string
  position?: number
  face?: Face
  location?: string
  role?: string
  netRef?: string
  status?: Status
  notes?: string
}

export interface OutletGroup { connector: string; count: number }

export interface Pdu {
  id: string
  name?: string
  rack: string
  feed: string
  circuit?: string
  mounting?: '0U-left' | '0U-right' | 'rack'
  position?: number
  heightU?: number
  face?: Face
  voltage: number
  maxAmps: number
  phases?: 1 | 3
  weightKg?: number
  outlets: OutletGroup[]
  notes?: string
}

export interface PowerLink { device: string; inlet: string; pdu: string; outlet: number }

export interface Endpoint { device: string; port: string; side?: Face }

export interface Cable {
  id: string
  label?: string
  a: Endpoint
  b: Endpoint
  media: Media
  lengthM?: number
  color?: string
  function?: string
  pathway?: string
  status?: Status
  notes?: string
}

export interface RackModel {
  $schema?: string
  modelVersion: 1
  meta: Meta
  policy?: Policy
  locations?: Location[]
  racks: Rack[]
  equipmentTypes?: EquipmentType[]
  devices: Device[]
  pdus?: Pdu[]
  powerLinks?: PowerLink[]
  cables?: Cable[]
}

export type Severity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  code: string
  severity: Severity
  message: string
  /** JSON-path-like pointer into the model, e.g. devices[3].position */
  path?: string
}

/** Thrown for user-facing problems (bad input, missing files); the CLI prints the message without a stack. */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}
