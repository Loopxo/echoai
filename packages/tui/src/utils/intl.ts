let graphemeSegmenter: Intl.Segmenter | null = null

export function getGraphemeSegmenter(): Intl.Segmenter {
    if (!graphemeSegmenter) {
        graphemeSegmenter = new Intl.Segmenter(undefined, {
            granularity: "grapheme",
        })
    }

    return graphemeSegmenter
}
