import {hourFromDate, MAX_CLOCK_HOURS_PER_SEC, type ClockSettings} from './fractalClock.ts'

function throwFromSpeed(hoursPerSecond: number) {
    return Math.max(-1, Math.min(1, hoursPerSecond / MAX_CLOCK_HOURS_PER_SEC))
}

function formatSpeed(settings: ClockSettings) {
    if (settings.syncToNow) return 'Synced'
    const t = throwFromSpeed(settings.hoursPerSecond)
    if (Math.abs(t) < 0.02) return '0'
    return `${t > 0 ? '+' : ''}${t.toFixed(2)}`
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

    const paint = () => {
        const t = settings.syncToNow ? 0 : throwFromSpeed(settings.hoursPerSecond)
        knob.style.left = `${((t + 1) / 2) * 100}%`
        stick.classList.toggle('is-synced', settings.syncToNow)
        stick.setAttribute('aria-valuenow', t.toFixed(2))
        speedLabel.textContent = formatSpeed(settings)
    }

    const setThrow = (t: number) => {
        const clamped = Math.abs(t) < 0.04 ? 0 : Math.max(-1, Math.min(1, t))
        settings.syncToNow = false
        settings.hoursPerSecond = clamped * MAX_CLOCK_HOURS_PER_SEC
        paint()
    }

    const throwFromClientX = (clientX: number) => {
        const rect = stick.getBoundingClientRect()
        const pad = knob.offsetWidth / 2
        const span = Math.max(1, rect.width - pad * 2)
        return ((clientX - rect.left - pad) / span) * 2 - 1
    }

    paint()

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
        paint()
    })

    stick.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        stick.setPointerCapture(event.pointerId)
        setThrow(throwFromClientX(event.clientX))
    })
    stick.addEventListener('pointermove', (event) => {
        if (!stick.hasPointerCapture(event.pointerId)) return
        setThrow(throwFromClientX(event.clientX))
    })

    stick.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 0.2 : 0.05
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            setThrow(throwFromSpeed(settings.hoursPerSecond) - step)
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            setThrow(throwFromSpeed(settings.hoursPerSecond) + step)
        } else if (event.key === 'Home') {
            event.preventDefault()
            setThrow(-1)
        } else if (event.key === 'End') {
            event.preventDefault()
            setThrow(1)
        } else if (event.key === '0' || event.key === 'Delete') {
            event.preventDefault()
            setThrow(0)
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
