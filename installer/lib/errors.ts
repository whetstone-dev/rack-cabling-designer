// Turn filesystem errors into actionable messages. The installer never asks for elevated
// rights: permission problems are answered with a folder the user owns, not with sudo/admin.

export function explainFsError(e: unknown, path?: string): string {
  const err = e as NodeJS.ErrnoException
  const where = path ?? err.path ?? ''
  switch (err.code) {
    case 'EACCES':
    case 'EPERM':
      return `permission denied at ${where}. Choose project scope or a folder you own; administrator rights are not needed and should not be used.`
    case 'EBUSY':
      return `${where} is in use (a running assistant or editor may lock it). Close it and run the installer again.`
    case 'ENOSPC':
      return `no space left on the device for ${where}.`
    case 'ENOTDIR':
      return `${where} is a file where a folder was expected. Move it away or choose another destination.`
    case 'EEXIST':
      return `${where} appeared while installing (another process?). Run the installer again.`
    case 'ENAMETOOLONG':
      return `path too long: ${where}. Use a shorter project path${process.platform === 'win32' ? ' or enable Windows long paths' : ''}.`
    case 'EROFS':
      return `${where} is on a read-only file system.`
    default:
      return err?.message ?? String(e)
  }
}

/** POSIX only: running as root is never required and would leave root-owned files. */
export function elevationWarning(): string | undefined {
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
  return uid === 0 ? 'Running as root is not needed and creates root-owned files in your home. Run as your normal user.' : undefined
}
