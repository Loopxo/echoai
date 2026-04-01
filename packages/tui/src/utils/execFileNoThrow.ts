import { spawn } from "node:child_process"

export function execFileNoThrow(
    file: string,
    args: string[],
    options: {
        timeout?: number
        stdin?: "ignore" | "inherit" | "pipe"
        input?: string
        useCwd?: boolean
    } = {}
): Promise<{ stdout: string; stderr: string; code: number; error?: string }> {
    return new Promise((resolve) => {
        const child = spawn(file, args, {
            cwd: options.useCwd === false ? undefined : process.cwd(),
            stdio: "pipe",
        })

        let stdout = ""
        let stderr = ""
        let settled = false
        const timeout = options.timeout
            ? setTimeout(() => {
                if (!settled) {
                    child.kill("SIGTERM")
                }
            }, options.timeout)
            : undefined

        child.stdout.on("data", (chunk) => {
            stdout += String(chunk)
        })
        child.stderr.on("data", (chunk) => {
            stderr += String(chunk)
        })
        child.on("error", (error) => {
            if (settled) {
                return
            }
            settled = true
            if (timeout) {
                clearTimeout(timeout)
            }
            resolve({
                stdout,
                stderr,
                code: 1,
                error: error.message,
            })
        })
        child.on("close", (code) => {
            if (settled) {
                return
            }
            settled = true
            if (timeout) {
                clearTimeout(timeout)
            }
            resolve({
                stdout,
                stderr,
                code: code ?? 1,
                error: code === 0 ? undefined : stderr || `Command exited with code ${code ?? 1}`,
            })
        })

        if (options.stdin === "pipe" && options.input) {
            child.stdin.write(options.input)
        }
        child.stdin.end()
    })
}
