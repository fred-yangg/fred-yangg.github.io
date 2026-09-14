import {INSTANCE_FLOATS, MAX_INSTANCES} from './constants.ts'

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec2 aOrigin;
layout(location = 2) in float aAngle;
layout(location = 3) in float aLength;
layout(location = 4) in float aWidth;
layout(location = 5) in vec3 aColor;

uniform vec2 uResolution;

out vec3 vColor;

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
    vColor = aColor;
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

in vec3 vColor;

out vec4 outColor;

void main() {
    outColor = vec4(vColor, 1.0);
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

export type ClockGl = {
    resize: () => void
    draw: (instances: Float32Array, count: number, cssWidth: number, cssHeight: number) => void
    dispose: () => void
}

export function createClockGl(canvas: HTMLCanvasElement): ClockGl {
    const gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        depth: true,
        premultipliedAlpha: false,
    })
    if (!gl) throw new Error('WebGL2 is required for the fractal clock')

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
    gl.bufferData(gl.ARRAY_BUFFER, MAX_INSTANCES * INSTANCE_FLOATS * 4, gl.DYNAMIC_DRAW)
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
    gl.enableVertexAttribArray(5)
    gl.vertexAttribPointer(5, 3, gl.FLOAT, false, instanceStride, 20)
    gl.vertexAttribDivisor(5, 1)

    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LESS)
    gl.clearColor(0, 0, 0, 0)
    gl.clearDepth(1)

    return {
        resize() {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
        },
        draw(instances, count, cssWidth, cssHeight) {
            gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
            const srcOffset = (MAX_INSTANCES - count) * INSTANCE_FLOATS
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, srcOffset, count * INSTANCE_FLOATS)
            gl.useProgram(program)
            gl.bindVertexArray(vao)
            gl.uniform2f(uResolution, cssWidth, cssHeight)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)
        },
        dispose() {
            gl.deleteProgram(program)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
        },
    }
}
