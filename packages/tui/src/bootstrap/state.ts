let lastInteractionTime = Date.now()

export function updateLastInteractionTime(): void {
    lastInteractionTime = Date.now()
}

export function flushInteractionTime(): void {
    lastInteractionTime = Date.now()
}

export function getLastInteractionTime(): number {
    return lastInteractionTime
}

export function markScrollActivity(): void {
    lastInteractionTime = Date.now()
}
