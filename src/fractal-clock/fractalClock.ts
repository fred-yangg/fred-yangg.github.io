type Hand = {
    enabled: boolean
    angle: number
}

const SCALE = 1 / Math.SQRT2
const MIN_LENGTH_PX = 0.5
const ROOT_STROKE_WIDTH_PX = 4
const CHILD_STROKE_WIDTH_PX = 1
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

function updateTimeAngles(hands: Hand[]) {
    const date = new Date()
    const millisecond = date.getMilliseconds()
    const second = date.getSeconds() + millisecond / 1000
    const minute = date.getMinutes() + second / 60
    const hour = date.getHours() + minute / 60

    const [hourHand, minuteHand, secondHand] = hands
    hourHand.angle = ((hour % 12) / 12) * Math.PI * 2
    minuteHand.angle = (minute / 60) * Math.PI * 2
    secondHand.angle = (second / 60) * Math.PI * 2
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
    stack[sp++] = ROOT_STROKE_WIDTH_PX

    while (sp > 0) {
        const width = stack[--sp]
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
            out[i + 4] = width
            count++

            const childLen = len * SCALE
            if (childLen < MIN_LENGTH_PX) continue
            if (sp + INSTANCE_FLOATS > stack.length) continue
            stack[sp++] = x + len * Math.sin(angle)
            stack[sp++] = y - len * Math.cos(angle)
            stack[sp++] = angle
            stack[sp++] = childLen
            stack[sp++] = CHILD_STROKE_WIDTH_PX
        }
    }

    return count
}

function drawNumbers(
    ctx: CanvasRenderingContext2D,
    cssWidth: number,
    cssHeight: number,
    numberRadius: number,
) {
    ctx.clearRect(0, 0, cssWidth, cssHeight)
    ctx.save()
    ctx.translate(cssWidth / 2, cssHeight / 2)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(0, 0, numberRadius + 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#000'
    ctx.font = '36px "Courier New"'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 1; i <= 12; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 6
        ctx.fillText(
            String(i),
            numberRadius * Math.cos(angle),
            numberRadius * Math.sin(angle),
        )
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

export function startClock(container: HTMLElement) {
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
        {enabled: false, angle: 0},
        {enabled: true, angle: 0},
        {enabled: true, angle: 0},
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
    let numberRadius = 0
    let raf = 0
    let observer: ResizeObserver | undefined

    const layout = () => {
        cssWidth = container.clientWidth
        cssHeight = container.clientHeight
        if (cssWidth < 1 || cssHeight < 1) return
        const dpr = resizeCanvas(glCanvas, cssWidth, cssHeight)
        resizeCanvas(numbersCanvas, cssWidth, cssHeight)
        numbersCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
        handLength = Math.min(cssWidth, cssHeight) / 5
        numberRadius = handLength * 2
        drawNumbers(numbersCtx, cssWidth, cssHeight, numberRadius)
    }

    const frame = () => {
        raf = requestAnimationFrame(frame)
        if (cssWidth < 1 || cssHeight < 1) return

        updateTimeAngles(hands)
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
