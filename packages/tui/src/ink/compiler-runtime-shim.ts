const MEMO_SENTINEL = Symbol.for("react.memo_cache_sentinel")

export function c(size: number): unknown[] {
    return Array.from({
        length: size,
    }, () => MEMO_SENTINEL)
}
