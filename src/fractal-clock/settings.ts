import {hourFromDate, MAX_MINUTE_RPS, type ClockSettings} from './fractalClock.ts'

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

    let latched = false

    const throwFromSpeed = () => {
        if (settings.syncToNow) return 0
        return Math.max(-1, Math.min(1, settings.hoursPerSecond / MAX_MINUTE_RPS))
    }

    const knobPad = () => knob.offsetWidth / 2 + 2

    const paintStick = () => {
        const t = throwFromSpeed()
        const pad = knobPad()
        knob.style.left = `calc(${pad}px + ${(t + 1) / 2} * (100% - ${pad * 2}px))`
        stick.classList.toggle('is-synced', settings.syncToNow)
        stick.classList.toggle('is-latched', latched)
        stick.setAttribute('aria-valuenow', t.toFixed(2))
    }

    const paintSpeed = () => {
        speedLabel.textContent = formatVelocity(settings)
    }

    const setThrow = (t: number) => {
        const clamped = Math.abs(t) < 0.04 ? 0 : Math.max(-1, Math.min(1, t))
        settings.syncToNow = false
        settings.hoursPerSecond = clamped * MAX_MINUTE_RPS
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
        settings.hour = hourFromDate()
        latched = false
        stick.classList.remove('is-dragging')
        paintStick()
        paintSpeed()
    })

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
}
