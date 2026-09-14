import {hourFromDate, type ClockSettings} from './fractalClock.ts'

function formatHour(hour: number) {
    const wrapped = ((hour % 12) + 12) % 12
    const totalMinutes = wrapped * 60
    const h = Math.floor(totalMinutes / 60) % 12 || 12
    const m = Math.floor(totalMinutes % 60)
    return `${h}:${String(m).padStart(2, '0')}`
}

export function mountSettings(settings: ClockSettings) {
    const button = document.getElementById('clock-settings-btn')
    const menu = document.getElementById('clock-settings-menu')
    const sync = document.getElementById('setting-sync')
    const time = document.getElementById('setting-time')
    const timeLabel = document.getElementById('setting-time-label')
    if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
        throw new Error('Missing settings controls')
    }
    if (!(sync instanceof HTMLInputElement) || !(time instanceof HTMLInputElement) || !timeLabel) {
        throw new Error('Missing time settings')
    }

    let scrubbing = false

    const paintTime = () => {
        time.value = String(settings.hour)
        timeLabel.textContent = formatHour(settings.hour)
    }

    const setSync = (on: boolean) => {
        settings.syncToNow = on
        sync.checked = on
        if (on) settings.hour = hourFromDate()
        paintTime()
    }

    sync.checked = settings.syncToNow
    paintTime()

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

    sync.addEventListener('change', () => {
        if (sync.checked) setSync(true)
        else {
            settings.hour = hourFromDate()
            setSync(false)
        }
    })

    const steer = () => {
        settings.syncToNow = false
        sync.checked = false
        settings.hour = Number(time.value)
        timeLabel.textContent = formatHour(settings.hour)
    }

    time.addEventListener('pointerdown', () => {
        scrubbing = true
    })
    time.addEventListener('pointerup', () => {
        scrubbing = false
    })
    time.addEventListener('pointercancel', () => {
        scrubbing = false
    })
    time.addEventListener('input', steer)

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
        if (settings.syncToNow && !scrubbing) paintTime()
        requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
}
