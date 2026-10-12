// Shared installer types. Adapters describe platforms as data; detection, planning, execution
// and verification are separate modules that consume them.

export type KnownAgentId = 'claude-code' | 'codex' | 'cursor'
/** "custom" = any other Agent Skills-compatible app, installed into a folder the user chooses */
export type AgentId = KnownAgentId | 'custom'
export type Scope = 'user' | 'project'

export interface Context {
  /** User home directory (overridable for tests with RCD_INSTALL_HOME) */
  home: string
  /** Project directory for project scope */
  projectDir: string
  env: Record<string, string | undefined>
  platform: NodeJS.Platform
  /** Installer state: staging, backups and logs, outside every skills root */
  stateDir: string
  /** Skills folder chosen manually for the "custom" platform (validated by validateCustomRoot) */
  customRoot?: string
}

export interface Detection { present: boolean; evidence: string[] }

export interface CheckResult { name: string; status: 'pass' | 'warn' | 'fail'; detail?: string }

export interface Adapter {
  id: AgentId
  displayName: string
  /** Official documentation used to derive the paths below */
  docs: string[]
  /** What this installer cannot detect or verify for the platform (shown to the user) */
  limitations: string[]
  /** Native skills root this platform installs into for the scope */
  installRoot(scope: Scope, ctx: Context): string
  /** Every skills root the platform scans for the scope, native first, then compatibility roots */
  scanRoots(scope: Scope, ctx: Context): string[]
  detect(ctx: Context): Detection
  /** How to make a fresh install visible in a running session */
  activation(scope: Scope): string
  /** How the user invokes the skill explicitly */
  invocation: string
  /** Payload files this platform uses that others ignore (informational) */
  specificFiles: string[]
  /** Platform-specific checks on an installed copy (read-only, never executes code) */
  check(skillDir: string, ctx: Context): CheckResult[]
}

export class InstallerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InstallerError'
  }
}
