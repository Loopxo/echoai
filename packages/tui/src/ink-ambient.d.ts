declare const Bun:
    | {
        stringWidth?(value: string, options?: unknown): number
        wrapAnsi?(value: string, columns: number, options?: unknown): string
        semver?: {
            order(a: string, b: string): -1 | 0 | 1
            satisfies(version: string, range: string): boolean
        }
    }
    | undefined

declare namespace React {
    namespace JSX {
        interface IntrinsicElements {
            "ink-box": Record<string, unknown>
            "ink-text": Record<string, unknown>
            "ink-link": Record<string, unknown>
            "ink-raw-ansi": Record<string, unknown>
        }
    }
}

declare namespace JSX {
    interface IntrinsicElements {
        "ink-box": Record<string, unknown>
        "ink-text": Record<string, unknown>
        "ink-link": Record<string, unknown>
        "ink-raw-ansi": Record<string, unknown>
    }
}

declare module "react-reconciler" {
    function createReconciler<
        A = any,
        B = any,
        C = any,
        D = any,
        E = any,
        F = any,
        G = any,
        H = any,
        I = any,
        J = any,
        K = any,
        L = any,
        M = any,
        N = any
    >(config: any): any
    export type FiberRoot = any
    export default createReconciler
}

declare module "react-reconciler/constants.js" {
    export const ConcurrentRoot: any
    export const LegacyRoot: any
    export const NoEventPriority: any
    export const DiscreteEventPriority: any
    export const ContinuousEventPriority: any
    export const DefaultEventPriority: any
    export const IdleEventPriority: any
}

declare module "lodash-es/noop.js" {
    const noop: () => void
    export default noop
}

declare module "lodash-es/throttle.js" {
    const throttle: <T extends (...args: any[]) => any>(
        fn: T,
        wait?: number,
        options?: Record<string, unknown>
    ) => T & { cancel?: () => void }
    export default throttle
}

declare module "bidi-js" {
    const bidiFactory: any
    export default bidiFactory
}

declare module "stack-utils" {
    class StackUtils {
        static nodeInternals(): any
        constructor(options?: any)
        parseLine(line: string): any
        clean(stack: string): string
    }
    export default StackUtils
}

declare module "semver" {
    const semver: any
    export default semver
    export const coerce: any
}
