// Interactive interface. One line reader with a queue, so it behaves the same on a terminal
// and with piped input (tests). End of input always means "no" / cancel.

import { createInterface, type Interface } from 'node:readline'
import { ADAPTERS } from '../adapters/index.ts'
import { validateCustomRoot } from '../adapters/custom.ts'
import { pretty } from './context.ts'
import type { PlatformStatus } from './detect.ts'
import type { AgentId, Context, Scope } from './types.ts'
import { InstallerError } from './types.ts'

export class Prompter {
  private rl: Interface
  private queue: string[] = []
  private waiting?: (line: string | undefined) => void
  private closed = false
  private output: NodeJS.WritableStream
  /** Echo answers when input is not a terminal (piped answers are otherwise invisible). */
  private echo: boolean

  constructor(input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout) {
    this.output = output
    this.echo = !(input as NodeJS.ReadStream).isTTY
    this.rl = createInterface({ input, terminal: false })
    this.rl.on('line', (line) => {
      if (this.waiting) { const w = this.waiting; this.waiting = undefined; w(line) }
      else this.queue.push(line)
    })
    this.rl.on('close', () => {
      this.closed = true
      if (this.waiting) { const w = this.waiting; this.waiting = undefined; w(undefined) }
    })
  }

  /** Ask a question; resolves to the trimmed answer, or undefined at end of input. */
  async ask(question: string): Promise<string | undefined> {
    this.output.write(question)
    const queued = this.queue.shift()
    if (queued !== undefined) { if (this.echo) this.output.write(`${queued}\n`); return queued.trim() }
    if (this.closed) { this.output.write('\n'); return undefined }
    const line = await new Promise<string | undefined>((resolve) => { this.waiting = resolve })
    if (this.echo) this.output.write(`${line ?? ''}\n`)
    return line?.trim()
  }

  async confirm(question: string): Promise<boolean> {
    const a = await this.ask(`${question} [y/N]: `)
    return !!a && /^(y|yes|s|si|sí)$/i.test(a)
  }

  close(): void {
    this.rl.close()
  }
}

export function say(line = ''): void {
  process.stdout.write(`${line}\n`)
}

export interface Selection { agents: AgentId[]; customRoot?: string }

/** Step: choose assistants. Undetected ones can be chosen manually after their limitations are shown. */
export async function askAgents(p: Prompter, platforms: PlatformStatus[], ctx: Context, forbidden: string[]): Promise<Selection> {
  say('Step 1 · Assistants')
  platforms.forEach((s, i) => {
    say(`  ${i + 1}) ${(s.present ? '[detected]' : '[not detected]').padEnd(15)} ${s.name.padEnd(14)} ${s.present ? s.evidence.join(', ') : 'can still be selected manually'}`)
  })
  const customIndex = platforms.length + 1
  say(`  ${customIndex}) ${'[manual]'.padEnd(15)} Other Agent Skills-compatible app (you choose its skills folder)`)
  const defaults = platforms.filter((s) => s.present).map((s) => s.id)
  const answer = (await p.ask(`Select one or more (e.g. 1,3), "a" = all three, Enter = detected [${defaults.join(', ') || 'none'}]: `))
  if (answer === undefined) throw new InstallerError('Cancelled (no input).')
  let picked: (AgentId | 'custom')[]
  if (!answer) picked = defaults
  else if (/^(a|all)$/i.test(answer)) picked = ADAPTERS.map((a) => a.id)
  else {
    picked = answer.split(/[\s,]+/).map((x) => {
      const n = Number(x)
      if (n === customIndex || x === 'custom') return 'custom'
      const hit = Number.isInteger(n) ? platforms[n - 1] : platforms.find((s) => s.id === x)
      if (!hit) throw new InstallerError(`Invalid choice "${x}".`)
      return hit.id
    })
  }
  picked = [...new Set(picked)]
  if (picked.length === 0) throw new InstallerError('No assistant detected or selected.')

  const chosen: AgentId[] = []
  for (const id of picked) {
    if (id === 'custom') continue
    const s = platforms.find((x) => x.id === id)!
    if (!s.present) {
      say(`\n${s.name} was not detected. Limitations:`)
      for (const l of s.limitations) say(`  - ${l}`)
      if (!(await p.confirm(`Install for ${s.name} anyway (files only; you confirm it in the app)?`))) continue
    }
    chosen.push(id)
  }
  let customRoot: string | undefined
  if (picked.includes('custom')) {
    say('\nOther compatible app: the installer cannot detect it or verify that it loads the skill; it verifies files, format and the self-test.')
    const folder = await p.ask('Skills folder of that app (inside your home or this project, e.g. ~/.myapp/skills): ')
    if (folder) {
      customRoot = validateCustomRoot(folder.replace(/^~(?=$|[\\/])/, ctx.home), ctx, forbidden)
      chosen.push('custom')
      say(`  → ${pretty(customRoot, ctx)}`)
    }
  }
  if (chosen.length === 0) throw new InstallerError('Nothing selected.')
  return { agents: chosen, customRoot }
}

export async function askScope(p: Prompter, ctx: Context): Promise<Scope> {
  say('\nStep 2 · Scope')
  say(`  1) user     every project of this user (${pretty(ctx.home, ctx)})`)
  say(`  2) project  only ${ctx.projectDir}`)
  const answer = await p.ask('Choose [1]: ')
  if (answer === undefined) throw new InstallerError('Cancelled (no input).')
  if (!answer || answer === '1' || answer === 'user') return 'user'
  if (answer === '2' || answer === 'project') return 'project'
  throw new InstallerError(`Invalid scope "${answer}".`)
}
