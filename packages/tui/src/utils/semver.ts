import semver from "semver"

export function gte(a: string, b: string): boolean {
    return semver.gte(a, b, { loose: true })
}
