import {REALTIME_MINUTE_RPS, ROOT_HOUR_WIDTH_PX, ROOT_MINUTE_WIDTH_PX} from './constants.ts'
import {updateTimeAngles} from './time.ts'
import type {ClockSettings, Hand} from './types.ts'

function wrapPi(delta: number) {
    const tau = Math.PI * 2
    return delta - Math.round(delta / tau) * tau
}

function pointerAngle(dx: number, dy: number) {
    return Math.atan2(dx, -dy)
}

function handHit(
    dx: number,
    dy: number,
    angle: number,
    length: number,
    hitWidth: number,
) {
    const dirx = Math.sin(angle)
    const diry = -Math.cos(angle)
    const along = dx * dirx + dy * diry
    if (along < -hitWidth || along > length + hitWidth) return null
    const perp = Math.abs(dirx * dy - diry * dx)
    if (perp > hitWidth) return null
    return perp
}

export type HandDrag = {
    isDragging: () => boolean
    dispose: () => void
}

export function attachHandDrag(
    canvas: HTMLCanvasElement,
    settings: ClockSettings,
    hands: Hand[],
    size: () => {width: number; height: number; handLength: number},
): HandDrag {
    let dragging: 'hour' | 'minute' | undefined
    let lastDragAngle = 0
    let resumeRealtimeAfterDrag = false

    const pointerLocal = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect()
        return {x: event.clientX - rect.left, y: event.clientY - rect.top}
    }

    const pickHand = (x: number, y: number) => {
        const {width, height, handLength} = size()
        const dx = x - width / 2
        const dy = y - height / 2
        updateTimeAngles(hands, settings.hour)
        const hourHit = handHit(
            dx,
            dy,
            hands[0].angle,
            handLength,
            Math.max(16, ROOT_HOUR_WIDTH_PX * 1.5),
        )
        const minuteHit = handHit(
            dx,
            dy,
            hands[1].angle,
            handLength,
            Math.max(14, ROOT_MINUTE_WIDTH_PX * 1.5),
        )
        if (hourHit == null && minuteHit == null) return
        if (hourHit == null) return 'minute' as const
        if (minuteHit == null) return 'hour' as const
        return hourHit <= minuteHit ? 'hour' as const : 'minute' as const
    }

    const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return
        const {x, y} = pointerLocal(event)
        const which = pickHand(x, y)
        if (!which) return
        event.preventDefault()
        event.stopPropagation()
        dragging = which
        const {width, height} = size()
        lastDragAngle = pointerAngle(x - width / 2, y - height / 2)
        resumeRealtimeAfterDrag = settings.syncToNow
        settings.syncToNow = false
        canvas.setPointerCapture(event.pointerId)
        canvas.style.cursor = 'grabbing'
    }

    const onPointerMove = (event: PointerEvent) => {
        const {x, y} = pointerLocal(event)
        const {width, height} = size()
        if (!dragging) {
            canvas.style.cursor = pickHand(x, y) ? 'grab' : ''
            return
        }
        const angle = pointerAngle(x - width / 2, y - height / 2)
        const delta = wrapPi(angle - lastDragAngle)
        lastDragAngle = angle
        settings.hour += dragging === 'minute'
            ? delta / (Math.PI * 2)
            : delta / (Math.PI * 2) * 12
    }

    const onPointerUp = () => {
        if (!dragging) return
        dragging = undefined
        if (resumeRealtimeAfterDrag) settings.hoursPerSecond = REALTIME_MINUTE_RPS
        resumeRealtimeAfterDrag = false
        canvas.style.cursor = ''
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return {
        isDragging: () => Boolean(dragging),
        dispose() {
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerup', onPointerUp)
            canvas.removeEventListener('pointercancel', onPointerUp)
        },
    }
}
