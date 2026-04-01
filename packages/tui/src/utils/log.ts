export function logError(error: unknown): void {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
}
