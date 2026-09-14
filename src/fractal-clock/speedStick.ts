import {MAX_MINUTE_RPS, REALTIME_MINUTE_RPS} from './constants.ts'
import {hourFromDate} from './time.ts'
import type {ClockSettings} from './types.ts'

const SUPER = {
    '-': '⁻',
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
} as const

function superscript(n: number) {
    return String(n).replace(/[-0-9]/g, (c) => SUPER[c as keyof typeof SUPER] ?? c)
}

function formatVelocity(settings: ClockSettings) {
    if (settings.syncToNow) return 'Synced'
    const realtime = settings.hoursPerSecond / REALTIME_MINUTE_RPS
    if (Math.abs(realtime) < 1e-12) return 'Paused'
    const sign = realtime < 0 ? '-' : ''
    const abs = Math.abs(realtime)
    const mag = Math.floor(Math.log10(abs))
    if (mag <= -5) {
        let exp = mag
        let coeff = Number((abs / 10 ** exp).toFixed(1))
        if (coeff >= 10) {
            coeff /= 10
            exp += 1
        }
        return `${sign}${coeff.toFixed(1)}×10${superscript(exp)}×`
    }
    const decimals = Math.max(0, 1 - mag)
    return `${sign}${abs.toFixed(decimals)}×`
}

export type SpeedStickEls = {
    sync: HTMLButtonElement
    pause: HTMLButtonElement
    realtime: HTMLButtonElement
    stick: HTMLElement
    knob: HTMLElement
    speedLabel: HTMLElement
}

export function mountSpeedStick(settings: ClockSettings, els: SpeedStickEls) {
    const {sync, pause, realtime, stick, knob, speedLabel} = els
    let latched = false

    const throwFromSpeed = () => {
        if (settings.syncToNow) return 0
        const n = settings.hoursPerSecond / MAX_MINUTE_RPS
        return Math.max(-1, Math.min(1, Math.sign(n) * Math.abs(n) ** 0.2))
    }

    const knobPad = () => knob.offsetWidth / 2 + 2

    const paintStick = () => {
        const t = throwFromSpeed()
        const pad = knobPad()
        knob.style.left = `calc(${pad}px + ${(t + 1) / 2} * (100% - ${pad * 2}px))`
        stick.classList.toggle('is-synced', settings.syncToNow)
        stick.classList.toggle(
            'is-paused',
            !settings.syncToNow && Math.abs(settings.hoursPerSecond) < 1e-12,
        )
        stick.classList.toggle('is-latched', latched && Math.abs(settings.hoursPerSecond) >= 1e-12)
        stick.setAttribute('aria-valuenow', t.toFixed(2))
    }

    const paintSpeed = () => {
        speedLabel.textContent = formatVelocity(settings)
    }

    const setThrow = (t: number) => {
        const clamped = Math.max(-1, Math.min(1, t))
        settings.syncToNow = false
        settings.hoursPerSecond = clamped ** 5 * MAX_MINUTE_RPS
        paintStick()
        paintSpeed()
    }

    const throwFromClientX = (clientX: number) => {
        const rect = stick.getBoundingClientRect()
        const pad = knobPad()
        const span = Math.max(1, rect.width - pad * 2)
        return ((clientX - rect.left - pad) / span) * 2 - 1
    }

    const lockFromClientY = (clientY: number) => {
        return clientY > stick.getBoundingClientRect().bottom
    }

    const dragTo = (event: PointerEvent) => {
        latched = lockFromClientY(event.clientY)
        setThrow(throwFromClientX(event.clientX))
    }

    const releaseStick = () => {
        stick.classList.remove('is-dragging')
        if (!latched) setThrow(0)
        else paintStick()
    }

    const applyPreset = (hoursPerSecond: number, syncToNow: boolean, latch: boolean) => {
        settings.syncToNow = syncToNow
        settings.hoursPerSecond = hoursPerSecond
        if (syncToNow) settings.hour = hourFromDate()
        latched = latch
        stick.classList.remove('is-dragging')
        paintStick()
        paintSpeed()
    }

    paintStick()
    paintSpeed()

    sync.addEventListener('click', () => applyPreset(0, true, false))
    pause.addEventListener('click', () => applyPreset(0, false, true))
    realtime.addEventListener('click', () => applyPreset(REALTIME_MINUTE_RPS, false, true))

    stick.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        stick.classList.add('is-dragging')
        stick.setPointerCapture(event.pointerId)
        dragTo(event)
    })
    stick.addEventListener('pointermove', (event) => {
        if (!stick.hasPointerCapture(event.pointerId)) return
        dragTo(event)
    })
    stick.addEventListener('pointerup', releaseStick)
    stick.addEventListener('pointercancel', releaseStick)

    stick.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 0.2 : 0.05
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            latched = false
            stick.classList.add('is-dragging')
            setThrow(throwFromSpeed() - step)
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            latched = false
            stick.classList.add('is-dragging')
            setThrow(throwFromSpeed() + step)
        } else if (event.key === 'Home') {
            event.preventDefault()
            latched = false
            stick.classList.add('is-dragging')
            setThrow(-1)
        } else if (event.key === 'End') {
            event.preventDefault()
            latched = false
            stick.classList.add('is-dragging')
            setThrow(1)
        }
    })
    stick.addEventListener('keyup', (event) => {
        if (
            event.key === 'ArrowLeft'
            || event.key === 'ArrowRight'
            || event.key === 'ArrowUp'
            || event.key === 'ArrowDown'
            || event.key === 'Home'
            || event.key === 'End'
        ) {
            releaseStick()
        }
    })

    return {
        refresh() {
            if (!stick.classList.contains('is-dragging')) {
                if (settings.syncToNow) latched = false
                paintStick()
                paintSpeed()
            }
        },
    }
}
