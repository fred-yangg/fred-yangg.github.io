import {
    applyClockTheme,
    hourFromDate,
    MAX_MINUTE_RPS,
    REALTIME_MINUTE_RPS,
    THEME_STORAGE_KEY,
    type ClockSettings,
    type ClockTheme,
} from './fractalClock.ts'

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

export function mountSettings(settings: ClockSettings) {
    const button = document.getElementById('clock-settings-btn')
    const menu = document.getElementById('clock-settings-menu')
    const sync = document.getElementById('setting-sync')
    const pause = document.getElementById('setting-pause')
    const realtime = document.getElementById('setting-realtime')
    const stick = document.getElementById('setting-stick')
    const knob = document.getElementById('setting-stick-knob')
    const speedLabel = document.getElementById('setting-speed-label')
    if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
        throw new Error('Missing settings controls')
    }
    if (
        !(sync instanceof HTMLButtonElement)
        || !(pause instanceof HTMLButtonElement)
        || !(realtime instanceof HTMLButtonElement)
        || !(stick instanceof HTMLElement)
        || !(knob instanceof HTMLElement)
        || !speedLabel
    ) {
        throw new Error('Missing speed settings')
    }

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
        stick.classList.toggle('is-latched', latched)
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

    pause.addEventListener('click', () => {
        settings.syncToNow = false
        settings.hoursPerSecond = 0
        latched = true
        stick.classList.remove('is-dragging')
        paintStick()
        paintSpeed()
    })

    realtime.addEventListener('click', () => {
        settings.syncToNow = false
        settings.hoursPerSecond = REALTIME_MINUTE_RPS
        latched = true
        stick.classList.remove('is-dragging')
        paintStick()
        paintSpeed()
    })

    const themeButtons = [...menu.querySelectorAll('[data-theme]')]
    const paintTheme = () => {
        for (const el of themeButtons) {
            if (!(el instanceof HTMLElement)) continue
            el.classList.toggle('is-active', el.dataset.theme === settings.theme)
        }
    }
    paintTheme()
    for (const el of themeButtons) {
        el.addEventListener('click', () => {
            if (!(el instanceof HTMLElement)) return
            const next = el.dataset.theme
            if (next !== 'light' && next !== 'dark' && next !== 'system') return
            const theme: ClockTheme = next
            settings.theme = theme
            applyClockTheme(theme)
            try {
                localStorage.setItem(THEME_STORAGE_KEY, theme)
            } catch {
                // ignore
            }
            paintTheme()
        })
    }

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

    const tick = () => {
        if (!stick.classList.contains('is-dragging')) {
            if (settings.syncToNow) latched = false
            paintStick()
            paintSpeed()
        }
        requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
}
