import {lerpColor} from './color.ts'
import {
    CHILD_STROKE_WIDTH_PX,
    INSTANCE_FLOATS,
    MAX_INSTANCES,
    MIN_LENGTH_PX,
    QUEUE_FLOATS,
    ROOT_HOUR_THICK_FRACTION,
    ROOT_HOUR_WIDTH_PX,
    ROOT_MINUTE_WIDTH_PX,
    SCALE,
} from './constants.ts'
import type {GradientCurve, Hand} from './types.ts'

export function createHands(): Hand[] {
    return [
        {enabled: true, angle: 0, rootWidth: ROOT_HOUR_WIDTH_PX, rootThickFraction: ROOT_HOUR_THICK_FRACTION, isHour: true},
        {enabled: true, angle: 0, rootWidth: ROOT_MINUTE_WIDTH_PX, rootThickFraction: 1, isHour: false},
    ]
}

function maxFractalDepth(rootLength: number) {
    let depth = 0
    let len = rootLength * SCALE
    while (len >= MIN_LENGTH_PX && depth < 40) {
        depth++
        len *= SCALE
    }
    return Math.max(1, depth)
}

export function fillInstances(
    out: Float32Array,
    queue: Float32Array,
    cx: number,
    cy: number,
    rootLength: number,
    hands: Hand[],
    startRgb: readonly number[],
    endRgb: readonly number[],
    inkRgb: readonly number[],
    curve: GradientCurve,
    hourBias: number,
    minuteBias: number,
) {
    let count = 0
    const maxLen = rootLength * SCALE
    const span = Math.max(maxLen - MIN_LENGTH_PX, 1e-6)
    const levels = maxFractalDepth(rootLength)
    const hBias = curve === 'biased' ? hourBias : 1
    const mBias = curve === 'biased' ? minuteBias : 1
    const colorAt = (len: number, depth: number, bias: number, isHour: boolean) => {
        const base = curve === 'linear'
            ? depth / levels
            : (maxLen - len) / span
        const t = base * bias * (isHour ? hBias : mBias)
        return lerpColor(startRgb, endRgb, t)
    }

    const emit = (
        ox: number,
        oy: number,
        angle: number,
        segLen: number,
        width: number,
        rgb: readonly number[],
    ) => {
        if (count >= MAX_INSTANCES) return false
        count++
        // Tail-first so the GPU draws deepest segments first (LESS rejects overdraw).
        const i = (MAX_INSTANCES - count) * INSTANCE_FLOATS
        out[i] = ox
        out[i + 1] = oy
        out[i + 2] = angle
        out[i + 3] = segLen
        out[i + 4] = width
        out[i + 5] = rgb[0]
        out[i + 6] = rgb[1]
        out[i + 7] = rgb[2]
        return true
    }

    let qh = 0
    let qt = 0
    const enqueue = (x: number, y: number, angle: number, len: number, depth: number, bias: number) => {
        if (qt + QUEUE_FLOATS > queue.length) return
        queue[qt++] = x
        queue[qt++] = y
        queue[qt++] = angle
        queue[qt++] = len
        queue[qt++] = depth
        queue[qt++] = bias
    }

    for (const hand of hands) {
        if (!hand.enabled) continue
        const angle = hand.angle
        const thickLen = rootLength * hand.rootThickFraction
        if (!emit(cx, cy, angle, thickLen, hand.rootWidth, inkRgb)) return count
    }

    for (const hand of hands) {
        if (!hand.enabled) continue
        const angle = hand.angle
        const thickLen = rootLength * hand.rootThickFraction
        if (hand.rootThickFraction < 1) {
            const thinLen = rootLength - thickLen
            if (thinLen >= MIN_LENGTH_PX) {
                if (!emit(
                    cx + thickLen * Math.sin(angle),
                    cy - thickLen * Math.cos(angle),
                    angle,
                    thinLen,
                    CHILD_STROKE_WIDTH_PX,
                    colorAt(thinLen, 0, 1, true),
                )) return count
            }
        }
        enqueue(
            cx + rootLength * Math.sin(angle),
            cy - rootLength * Math.cos(angle),
            angle,
            rootLength * SCALE,
            1,
            hand.isHour ? hBias : mBias,
        )
    }

    while (qh < qt) {
        const x = queue[qh++]
        const y = queue[qh++]
        const baseAngle = queue[qh++]
        const len = queue[qh++]
        const depth = queue[qh++]
        const bias = queue[qh++]
        if (len < MIN_LENGTH_PX) continue
        for (const hand of hands) {
            if (!hand.enabled) continue
            const angle = baseAngle + hand.angle
            if (!emit(x, y, angle, len, CHILD_STROKE_WIDTH_PX, colorAt(len, depth, bias, hand.isHour))) return count
            const childLen = len * SCALE
            if (childLen < MIN_LENGTH_PX) continue
            enqueue(
                x + len * Math.sin(angle),
                y - len * Math.cos(angle),
                angle,
                childLen,
                depth + 1,
                bias * (hand.isHour ? hBias : mBias),
            )
        }
    }

    return count
}
