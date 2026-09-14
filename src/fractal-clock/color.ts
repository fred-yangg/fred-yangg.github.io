import type {ResolvedTheme} from './types.ts'

export function parseHexColor(hex: string): [number, number, number] | null {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
    if (!m) return null
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
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

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (max === min) return [0, 0, l]
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    let h = 0
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
    return [h, s, l]
}

function hueToRgb(p: number, q: number, t: number) {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s === 0) return [l, l, l]
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)]
}

function rgbToHex(r: number, g: number, b: number) {
    const byte = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')
    return `#${byte(r)}${byte(g)}${byte(b)}`
}

export function invertHexLightness(hex: string) {
    const rgb = parseHexColor(hex)
    if (!rgb) return hex
    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
    const [r, g, b] = hslToRgb(h, s, 1 - l)
    return rgbToHex(r, g, b)
}

export function gradientDisplayHex(
    hex: string,
    forTheme: ResolvedTheme,
    now: ResolvedTheme,
) {
    return forTheme === now ? hex : invertHexLightness(hex)
}

export function resolveGradientRgb(
    hex: string,
    forTheme: ResolvedTheme,
    now: ResolvedTheme,
    fallback: string,
) {
    return parseHexColor(gradientDisplayHex(hex, forTheme, now))
        ?? parseHexColor(fallback)!
}
