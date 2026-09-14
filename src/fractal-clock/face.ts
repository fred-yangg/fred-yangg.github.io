type GlyphBox = {
    left: number
    right: number
    ascent: number
    descent: number
}

function measureGlyph(ctx: CanvasRenderingContext2D, text: string, fontSize: number): GlyphBox {
    const m = ctx.measureText(text)
    const left = m.actualBoundingBoxLeft || m.width / 2
    const right = m.actualBoundingBoxRight || m.width / 2
    const ascent = m.actualBoundingBoxAscent || fontSize * 0.8
    const descent = m.actualBoundingBoxDescent || fontSize * 0.2
    return {left, right, ascent, descent}
}

function glyphCornerRadius(cx: number, cy: number, box: GlyphBox) {
    const corners = [
        [-box.left, -box.ascent],
        [box.right, -box.ascent],
        [-box.left, box.descent],
        [box.right, box.descent],
    ]
    let max = 0
    for (const [x, y] of corners) {
        const r = Math.hypot(cx + x, cy + y)
        if (r > max) max = r
    }
    return max
}

function radiusForGlyph(angle: number, box: GlyphBox, targetOuter: number) {
    let lo = 0
    let hi = targetOuter
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2
        const cx = mid * Math.cos(angle)
        const cy = mid * Math.sin(angle)
        if (glyphCornerRadius(cx, cy, box) > targetOuter) hi = mid
        else lo = mid
    }
    return lo
}

export function drawFace(
    ctx: CanvasRenderingContext2D,
    cssWidth: number,
    cssHeight: number,
    handLength: number,
    ink: string,
    paper: string,
) {
    const discRadius = handLength * 1.1
    const fontSize = Math.max(10, discRadius * 0.13)
    const tickOuter = discRadius - Math.max(2, discRadius * 0.04)
    const hourTickInner = tickOuter - discRadius * 0.09
    const minuteTickInner = tickOuter - discRadius * 0.04
    const numberOuter = hourTickInner - Math.max(3, discRadius * 0.03)

    ctx.clearRect(0, 0, cssWidth, cssHeight)
    ctx.save()
    ctx.translate(cssWidth / 2, cssHeight / 2)

    ctx.fillStyle = paper
    ctx.strokeStyle = ink
    ctx.lineWidth = Math.max(1.5, discRadius * 0.012)
    ctx.beginPath()
    ctx.arc(0, 0, discRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.lineCap = 'butt'
    for (let i = 0; i < 60; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 30
        const hour = i % 5 === 0
        const inner = hour ? hourTickInner : minuteTickInner
        ctx.lineWidth = hour
            ? Math.max(1.75, discRadius * 0.014)
            : Math.max(1, discRadius * 0.006)
        ctx.beginPath()
        ctx.moveTo(inner * Math.cos(angle), inner * Math.sin(angle))
        ctx.lineTo(tickOuter * Math.cos(angle), tickOuter * Math.sin(angle))
        ctx.stroke()
    }

    ctx.fillStyle = ink
    ctx.font = `${fontSize}px "Courier New"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 1; i <= 12; i++) {
        const label = String(i)
        const angle = -Math.PI / 2 + i * Math.PI / 6
        const box = measureGlyph(ctx, label, fontSize)
        const r = radiusForGlyph(angle, box, numberOuter)
        ctx.fillText(label, r * Math.cos(angle), r * Math.sin(angle))
    }
    ctx.restore()
}

export function layoutDigitalTime(
    el: HTMLElement | null,
    cssHeight: number,
    handLength: number,
) {
    if (!el) return
    const discRadius = handLength * 1.1
    const fontSize = Math.max(8, Math.round(discRadius * 0.12))
    const gap = fontSize * 0.4
    const belowDisc = cssHeight / 2 - discRadius
    el.style.fontSize = `${fontSize}px`
    el.style.bottom = `${Math.max(8, Math.round(belowDisc - gap - fontSize))}px`
}
