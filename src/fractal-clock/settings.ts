import {hourFromDate, MAX_ACCEL_RPS2, type ClockSettings} from './fractalClock.ts'

function formatVelocity(settings: ClockSettings) {
    if (settings.syncToNow) return 'Synced'
    const v = settings.hoursPerSecond
    if (Math.abs(v) < 0.005) return '0.00 rps'
    return `${v > 0 ? '+' : ''}${v.toFixed(2)} rps`
}

export function mountSettings(settings: ClockSettings) {
    const button = document.getElementById('clock-settings-btn')
    const menu = document.getElementById('clock-settings-menu')
    const sync = document.getElementById('setting-sync')
    const stick = document.getElementById('setting-stick')
    const knob = document.getElementById('setting-stick-knob')
    const speedLabel = document.getElementById('setting-speed-label')
    if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
        throw new Error('Missing settings controls')
    }
    if (
        !(sync instanceof HTMLButtonElement)
        || !(stick instanceof HTMLElement)
        || !(knob instanceof HTMLElement)
        || !speedLabel
    ) {
        throw new Error('Missing speed settings')
    }

    const throwFromAccel = () => {
        if (settings.syncToNow) return 0
        return Math.max(-1, Math.min(1, settings.acceleration / MAX_ACCEL_RPS2))
    }

    const paintStick = () => {
        const t = throwFromAccel()
        knob.style.left = `${((t + 1) / 2) * 100}%`
        stick.classList.toggle('is-synced', settings.syncToNow)
        stick.setAttribute('aria-valuenow', t.toFixed(2))
    }

    const paintSpeed = () => {
        speedLabel.textContent = formatVelocity(settings)
    }

    const setThrow = (t: number) => {
        const clamped = Math.abs(t) < 0.04 ? 0 : Math.max(-1, Math.min(1, t))
        settings.syncToNow = false
        settings.acceleration = clamped * MAX_ACCEL_RPS2
        paintStick()
        paintSpeed()
    }

    const throwFromClientX = (clientX: number) => {
        const rect = stick.getBoundingClientRect()
        const pad = knob.offsetWidth / 2
        const span = Math.max(1, rect.width - pad * 2)
        return ((clientX - rect.left - pad) / span) * 2 - 1
    }

    const releaseStick = () => {
        stick.classList.remove('is-dragging')
        setThrow(0)
    }

    paintStick()
    paintSpeed()

    const setOpen = (open: boolean, restoreFocus = false) => {
        button.classList.toggle('is-open', open)
        menu.classList.toggle('is-open', open)
        button.setAttribute('aria-expanded', String(open))
        if (restoreFocus && !open) button.focus()
    }

    const isOpen = () => menu.classList.contains('is-open')

    button.addEventListener('click', (event) => {
        event.stopPropagation()
        setOpen(!isOpen())
    })

    sync.addEventListener('click', () => {
        settings.syncToNow = true
        settings.hoursPerSecond = 0
        settings.acceleration = 0
        settings.hour = hourFromDate()
        stick.classList.remove('is-dragging')
        paintStick()
        paintSpeed()
    })

    stick.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        stick.classList.add('is-dragging')
        stick.setPointerCapture(event.pointerId)
        setThrow(throwFromClientX(event.clientX))
    })
    stick.addEventListener('pointermove', (event) => {
        if (!stick.hasPointerCapture(event.pointerId)) return
        setThrow(throwFromClientX(event.clientX))
    })
    stick.addEventListener('pointerup', releaseStick)
    stick.addEventListener('pointercancel', releaseStick)

    stick.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 0.2 : 0.05
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            stick.classList.add('is-dragging')
            setThrow(throwFromAccel() - step)
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            stick.classList.add('is-dragging')
            setThrow(throwFromAccel() + step)
        } else if (event.key === 'Home') {
            event.preventDefault()
            stick.classList.add('is-dragging')
            setThrow(-1)
        } else if (event.key === 'End') {
            event.preventDefault()
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

    document.addEventListener('pointerdown', (event) => {
        if (!isOpen()) return
        const target = event.target
        if (target instanceof Node && (button.contains(target) || menu.contains(target))) return
        setOpen(false)
    })

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault()
            setOpen(false, true)
        }
    })

    const tick = () => {
        paintSpeed()
        requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
}
