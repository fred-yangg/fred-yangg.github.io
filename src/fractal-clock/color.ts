export function parseHexColor(hex: string): [number, number, number] | null {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
    if (!m) return null
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

export function parseHexColorOr(hex: string, fallback: string) {
    return parseHexColor(hex) ?? parseHexColor(fallback)!
}

export function parseCssColor(color: string): [number, number, number] {
    const hex = parseHexColor(color)
    if (hex) return hex
    const m = color.match(/rgba?\(\s*([\d.]+)[,\s/]+([\d.]+)[,\s/]+([\d.]+)/)
    if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255]
    return [0.067, 0.067, 0.067]
}

export function lerpColor(a: readonly number[], b: readonly number[], t: number) {
    const u = Math.min(1, Math.max(0, t))
    return [
        a[0] + (b[0] - a[0]) * u,
        a[1] + (b[1] - a[1]) * u,
        a[2] + (b[2] - a[2]) * u,
    ] as const
}
