import {parseHexColorOr} from './color.ts'
import {
    DEFAULT_FRACTAL_COLOR_END,
    DEFAULT_FRACTAL_COLOR_START,
    INSTANCE_FLOATS,
    MAX_INSTANCES,
    MAX_MINUTE_RPS,
    QUEUE_FLOATS,
    SCALE,
    VIEW_MARGIN_PX,
} from './constants.ts'
import {resizeCanvas} from './dom.ts'
import {drawFace, layoutDigitalTime} from './face.ts'
import {createHands, fillInstances} from './fractal.ts'
import {createClockGl} from './gl.ts'
import {attachHandDrag} from './interact.ts'
import {applyClockTheme, readThemeColors} from './theme.ts'
import {formatDigitalTime, hourFromDate, updateTimeAngles} from './time.ts'
import type {ClockSettings} from './types.ts'

export function startClock(container: HTMLElement, settings: ClockSettings) {
    const glCanvas = container.querySelector('#gl-canvas')
    const numbersCanvas = container.querySelector('#numbers-canvas')
    if (!(glCanvas instanceof HTMLCanvasElement) || !(numbersCanvas instanceof HTMLCanvasElement)) {
        throw new Error('Missing clock canvases')
    }

    const renderer = createClockGl(glCanvas)
    const numbersCtx = numbersCanvas.getContext('2d')
    if (!numbersCtx) throw new Error('2D canvas is required for clock numbers')
    const digitalTimeEl = container.querySelector('#digital-time')
    if (digitalTimeEl && !(digitalTimeEl instanceof HTMLElement)) {
        throw new Error('Digital time indicator is not an HTML element')
    }
    const digitalTime = digitalTimeEl instanceof HTMLElement ? digitalTimeEl : null

    const hands = createHands()
    const instances = new Float32Array(MAX_INSTANCES * INSTANCE_FLOATS)
    const queue = new Float32Array(MAX_INSTANCES * QUEUE_FLOATS)

    let cssWidth = 0
    let cssHeight = 0
    let handLength = 0
    let raf = 0
    let lastTs = performance.now()
    let lastTheme: string | undefined
    let observer: ResizeObserver | undefined

    const layout = () => {
        cssWidth = container.clientWidth
        cssHeight = container.clientHeight
        if (cssWidth < 1 || cssHeight < 1) return
        const dpr = resizeCanvas(glCanvas, cssWidth, cssHeight)
        resizeCanvas(numbersCanvas, cssWidth, cssHeight)
        numbersCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        renderer.resize()
        const maxReach = Math.min(cssWidth, cssHeight) / 2 - VIEW_MARGIN_PX
        handLength = Math.max(1, maxReach * (1 - SCALE))
        const colors = readThemeColors()
        drawFace(numbersCtx, cssWidth, cssHeight, handLength, colors.ink, colors.paper)
        layoutDigitalTime(digitalTime, cssHeight, handLength)
    }

    const drag = attachHandDrag(glCanvas, settings, hands, () => ({
        width: cssWidth,
        height: cssHeight,
        handLength,
    }))

    const frame = (ts: number) => {
        raf = requestAnimationFrame(frame)
        const dt = Math.min(0.05, (ts - lastTs) / 1000)
        lastTs = ts
        if (cssWidth < 1 || cssHeight < 1) return

        applyClockTheme(settings.theme)
        const colors = readThemeColors()
        if (colors.ink !== lastTheme) {
            lastTheme = colors.ink
            layout()
        }

        if (drag.isDragging()) {
            settings.syncToNow = false
        } else if (settings.syncToNow) {
            settings.hour = hourFromDate()
            settings.hoursPerSecond = 0
        } else {
            settings.hoursPerSecond = Math.max(
                -MAX_MINUTE_RPS,
                Math.min(MAX_MINUTE_RPS, settings.hoursPerSecond),
            )
            settings.hour += settings.hoursPerSecond * dt
        }
        updateTimeAngles(hands, settings.hour)
        if (digitalTime) {
            const label = formatDigitalTime(settings.hour)
            if (digitalTime.textContent !== label) digitalTime.textContent = label
        }
        const startRgb = parseHexColorOr(settings.fractalColorStart, DEFAULT_FRACTAL_COLOR_START)
        const endRgb = parseHexColorOr(settings.fractalColorEnd, DEFAULT_FRACTAL_COLOR_END)
        const count = fillInstances(
            instances,
            queue,
            cssWidth / 2,
            cssHeight / 2,
            handLength,
            hands,
            startRgb,
            endRgb,
            colors.inkRgb,
            settings.gradientCurve,
            settings.hourBias,
            settings.minuteBias,
        )
        renderer.draw(instances, count, cssWidth, cssHeight)
    }

    observer = new ResizeObserver(layout)
    observer.observe(container)
    layout()
    raf = requestAnimationFrame(frame)

    return () => {
        observer?.disconnect()
        drag.dispose()
        cancelAnimationFrame(raf)
        renderer.dispose()
    }
}
