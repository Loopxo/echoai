import type { ReactNode } from "react"
import inkRender, {
    createRoot as createInkRoot,
    type Instance,
    type RenderOptions,
    type Root,
    renderSync,
} from "./ink/root.js"

export type { Instance, RenderOptions, Root }
export { default as Box } from "./ink/components/Box.js"
export { default as Text } from "./ink/components/Text.js"
export { default as useInput } from "./ink/hooks/use-input.js"

export async function render(
    node: ReactNode,
    options?: NodeJS.WriteStream | RenderOptions
): Promise<Instance> {
    return inkRender(node, options)
}

export function renderNow(
    node: ReactNode,
    options?: NodeJS.WriteStream | RenderOptions
): Instance {
    return renderSync(node, options)
}

export async function createRoot(options?: RenderOptions): Promise<Root> {
    return createInkRoot(options)
}
