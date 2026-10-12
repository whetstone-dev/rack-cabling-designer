// Minimal dependency-free JSON Schema validator (the draft-07 subset used by
// assets/schema/rack-model.schema.json). Detects unknown fields (typos), wrong
// types and out-of-range values. The same schema gives editors autocompletion.

import type { Diagnostic } from './model.ts'
import { readJsonAsset } from './assets.ts'

type Schema = Record<string, unknown>

let cache: Schema | undefined
function rootSchema(): Schema {
  if (!cache) cache = readJsonAsset<Schema>('schema/rack-model.schema.json')
  return cache
}

function resolveRef(s: Schema): Schema {
  const ref = s.$ref
  if (typeof ref !== 'string') return s
  const name = ref.replace('#/definitions/', '')
  const def = (rootSchema().definitions as Record<string, Schema>)[name]
  if (!def) throw new Error(`Unknown schema reference: ${ref}`)
  return resolveRef(def)
}

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function matchesType(v: unknown, t: string | string[]): boolean {
  const actual = typeOf(v)
  return (Array.isArray(t) ? t : [t]).some((x) => x === actual || (x === 'number' && actual === 'integer'))
}

function suggestion(key: string, options: string[]): string {
  const lower = key.toLowerCase()
  const hit = options.find((o) => o.toLowerCase() === lower || o.toLowerCase().startsWith(lower.slice(0, 4)))
  return hit ? ` (did you mean "${hit}"?)` : ''
}

function check(v: unknown, s0: Schema, path: string, out: Diagnostic[]): void {
  const s = resolveRef(s0)
  const err = (message: string): void => { out.push({ code: 'RCD-SCHEMA', severity: 'error', message: `${path}: ${message}`, path }) }
  if ('const' in s && v !== s.const) { err(`must be ${JSON.stringify(s.const)}`); return }
  if (Array.isArray(s.enum) && !s.enum.includes(v)) { err(`value ${JSON.stringify(v)} not allowed (use: ${s.enum.join(', ')})`); return }
  if (s.type !== undefined && !matchesType(v, s.type as string | string[])) { err(`expected ${String(s.type)}, got ${typeOf(v)}`); return }
  if (typeof v === 'number') {
    if (typeof s.minimum === 'number' && v < s.minimum) err(`minimum is ${s.minimum}`)
    if (typeof s.maximum === 'number' && v > s.maximum) err(`maximum is ${s.maximum}`)
  }
  if (typeof v === 'string') {
    if (typeof s.minLength === 'number' && v.length < s.minLength) err(`must not be empty`)
    if (typeof s.maxLength === 'number' && v.length > s.maxLength) err(`longer than ${s.maxLength} characters`)
    if (typeof s.pattern === 'string' && !new RegExp(s.pattern).test(v)) err(`invalid format ${JSON.stringify(v)}${s.description ? ` (${String(s.description)})` : ''}`)
  }
  if (Array.isArray(v)) {
    if (typeof s.minItems === 'number' && v.length < s.minItems) err(`needs at least ${s.minItems} item(s)`)
    if (s.items) v.forEach((x, i) => check(x, s.items as Schema, `${path}[${i}]`, out))
  }
  if (typeOf(v) === 'object') {
    const obj = v as Record<string, unknown>
    const props = (s.properties ?? {}) as Record<string, Schema>
    for (const r of (s.required ?? []) as string[]) if (!Object.hasOwn(obj, r)) err(`missing required field "${r}"`)
    for (const [k, val] of Object.entries(obj)) {
      if (Object.hasOwn(props, k)) check(val, props[k], `${path}.${k}`, out)
      else if (s.additionalProperties === false) out.push({ code: 'RCD-SCHEMA', severity: 'error', message: `${path}.${k}: unknown field "${k}"${suggestion(k, Object.keys(props))}`, path: `${path}.${k}` })
      else if (s.additionalProperties && typeof s.additionalProperties === 'object') check(val, s.additionalProperties as Schema, `${path}.${k}`, out)
    }
  }
}

/** Validate a parsed model against the bundled schema. Paths start at "$". */
export function validateSchema(model: unknown): Diagnostic[] {
  const out: Diagnostic[] = []
  check(model, rootSchema(), '$', out)
  return out
}
