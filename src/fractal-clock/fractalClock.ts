export type ClockSettings = {
    syncToNow: boolean
    /** Hours into a 12-hour cycle. */
    hour: number
    /** Minute-hand revolutions per second. Clamped to ±MAX_MINUTE_RPS. */
    hoursPerSecond: number
    /** Minute-hand rps per second. Stick throw; 0 when released. */
    acceleration: number
}

export const MAX_MINUTE_RPS = 1
export const MAX_ACCEL_RPS2 = 2.5

type Hand = {
    enabled: boolean
    angle: number
    rootWidth: number
}

const SCALE = 1 / Math.SQRT2
const MIN_LENGTH_PX = 0.5
const ROOT_HOUR_WIDTH_PX = 6
const ROOT_MINUTE_WIDTH_PX = 4
const CHILD_STROKE_WIDTH_PX = 1
const VIEW_MARGIN_PX = 8
const MAX_INSTANCES = 1 << 20
const INSTANCE_FLOATS = 5

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec2 aOrigin;
layout(location = 2) in float aAngle;
layout(location = 3) in float aLength;
layout(location = 4) in float aWidth;

uniform vec2 uResolution;

void main() {
    vec2 hand = vec2(
        (aCorner.x - 0.5) * aWidth,
        aCorner.y * aLength
    );
    float c = cos(aAngle);
    float s = sin(aAngle);
    vec2 down = vec2(hand.x, -hand.y);
    vec2 rotated = vec2(down.x * c - down.y * s, down.x * s + down.y * c);
    vec2 canvas = aOrigin + rotated;
    gl_Position = vec4(
        canvas.x / uResolution.x * 2.0 - 1.0,
        1.0 - canvas.y / uResolution.y * 2.0,
        0.0,
        1.0
    );
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 outColor;

void main() {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('Failed to create shader')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) ?? 'unknown shader error'
        gl.deleteShader(shader)
        throw new Error(info)
    }
    return shader
}

export function hourFromDate(date = new Date()) {
    return (
        (date.getHours() % 12)
        + date.getMinutes() / 60
        + date.getSeconds() / 3600
        + date.getMilliseconds() / 3_600_000
    )
}

function updateTimeAngles(hands: Hand[], hour: number) {
    const wrapped = ((hour % 12) + 12) % 12
    const minute = (wrapped * 60) % 60
    const [hourHand, minuteHand] = hands
    hourHand.angle = (wrapped / 12) * Math.PI * 2
    minuteHand.angle = (minute / 60) * Math.PI * 2
}

function fillInstances(
    out: Float32Array,
    stack: Float32Array,
    cx: number,
    cy: number,
    rootLength: number,
    hands: Hand[],
) {
    let count = 0
    let sp = 0
    stack[sp++] = cx
    stack[sp++] = cy
    stack[sp++] = 0
    stack[sp++] = rootLength
    stack[sp++] = 0

    while (sp > 0) {
        const depth = stack[--sp]
        const len = stack[--sp]
        const baseAngle = stack[--sp]
        const y = stack[--sp]
        const x = stack[--sp]
        if (len < MIN_LENGTH_PX) continue

        for (const hand of hands) {
            if (!hand.enabled) continue
            if (count >= MAX_INSTANCES) return count

            const angle = baseAngle + hand.angle
            const i = count * INSTANCE_FLOATS
            out[i] = x
            out[i + 1] = y
            out[i + 2] = angle
            out[i + 3] = len
            out[i + 4] = depth === 0 ? hand.rootWidth : CHILD_STROKE_WIDTH_PX
            count++

            const childLen = len * SCALE
            if (childLen < MIN_LENGTH_PX) continue
            if (sp + INSTANCE_FLOATS > stack.length) continue
            stack[sp++] = x + len * Math.sin(angle)
            stack[sp++] = y - len * Math.cos(angle)
            stack[sp++] = angle
            stack[sp++] = childLen
            stack[sp++] = depth + 1
        }
    }

    return count
}

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

function drawFace(
    ctx: CanvasRenderingContext2D,
    cssWidth: number,
    cssHeight: number,
    handLength: number,
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

    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
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

    ctx.fillStyle = '#000'
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

function resizeCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number) {
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.floor(cssWidth * dpr))
    const h = Math.max(1, Math.floor(cssHeight * dpr))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    return dpr
}

export function startClock(container: HTMLElement, settings: ClockSettings) {
    const glCanvas = container.querySelector('#gl-canvas')
    const numbersCanvas = container.querySelector('#numbers-canvas')
    if (!(glCanvas instanceof HTMLCanvasElement) || !(numbersCanvas instanceof HTMLCanvasElement)) {
        throw new Error('Missing clock canvases')
    }

    const gl = glCanvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        depth: true,
        premultipliedAlpha: false,
    })
    if (!gl) throw new Error('WebGL2 is required for the fractal clock')

    const numbersCtx = numbersCanvas.getContext('2d')
    if (!numbersCtx) throw new Error('2D canvas is required for clock numbers')

    const hands: Hand[] = [
        {enabled: true, angle: 0, rootWidth: ROOT_HOUR_WIDTH_PX},
        {enabled: true, angle: 0, rootWidth: ROOT_MINUTE_WIDTH_PX},
    ]

    const instances = new Float32Array(MAX_INSTANCES * INSTANCE_FLOATS)
    const stack = new Float32Array(MAX_INSTANCES * INSTANCE_FLOATS)

    const program = gl.createProgram()
    if (!program) throw new Error('Failed to create program')
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed')
    }
    gl.useProgram(program)
    const uResolution = gl.getUniformLocation(program, 'uResolution')

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    const quadBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const instanceBuf = gl.createBuffer()
    const instanceStride = INSTANCE_FLOATS * 4
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
    gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, instanceStride, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, instanceStride, 8)
    gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, instanceStride, 12)
    gl.vertexAttribDivisor(3, 1)
    gl.enableVertexAttribArray(4)
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, instanceStride, 16)
    gl.vertexAttribDivisor(4, 1)

    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LESS)
    gl.clearColor(0, 0, 0, 0)
    gl.clearDepth(1)

    let cssWidth = 0
    let cssHeight = 0
    let handLength = 0
    let raf = 0
    let lastTs = performance.now()
    let observer: ResizeObserver | undefined

    const layout = () => {
        cssWidth = container.clientWidth
        cssHeight = container.clientHeight
        if (cssWidth < 1 || cssHeight < 1) return
        const dpr = resizeCanvas(glCanvas, cssWidth, cssHeight)
        resizeCanvas(numbersCanvas, cssWidth, cssHeight)
        numbersCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
        const maxReach = Math.min(cssWidth, cssHeight) / 2 - VIEW_MARGIN_PX
        handLength = Math.max(1, maxReach * (1 - SCALE))
        drawFace(numbersCtx, cssWidth, cssHeight, handLength)
    }

    const frame = (ts: number) => {
        raf = requestAnimationFrame(frame)
        const dt = Math.min(0.05, (ts - lastTs) / 1000)
        lastTs = ts
        if (cssWidth < 1 || cssHeight < 1) return

        if (settings.syncToNow) {
            settings.hour = hourFromDate()
            settings.hoursPerSecond = 0
        } else {
            settings.hoursPerSecond = Math.max(
                -MAX_MINUTE_RPS,
                Math.min(MAX_MINUTE_RPS, settings.hoursPerSecond + settings.acceleration * dt),
            )
            settings.hour += settings.hoursPerSecond * dt
        }
        updateTimeAngles(hands, settings.hour)
        const count = fillInstances(
            instances,
            stack,
            cssWidth / 2,
            cssHeight / 2,
            handLength,
            hands,
        )

        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, 0, count * INSTANCE_FLOATS)
        gl.useProgram(program)
        gl.bindVertexArray(vao)
        gl.uniform2f(uResolution, cssWidth, cssHeight)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)
    }

    observer = new ResizeObserver(layout)
    observer.observe(container)
    layout()
    raf = requestAnimationFrame(frame)

    return () => {
        observer?.disconnect()
        cancelAnimationFrame(raf)
        gl.deleteProgram(program)
        gl.deleteShader(vs)
        gl.deleteShader(fs)
    }
}
