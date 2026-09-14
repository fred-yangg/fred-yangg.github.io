import {clampBias, DEFAULT_HOUR_BIAS, DEFAULT_MINUTE_BIAS} from './constants.ts'
import {gradientDisplayHex} from './color.ts'
import {mustGetButton, mustGetById, mustGetInput} from './dom.ts'
import {mountSpeedStick} from './speedStick.ts'
import {saveClockTheme, saveFractalGradient} from './storage.ts'
import {applyClockTheme, effectiveClockTheme} from './theme.ts'
import type {ClockSettings, ClockTheme, GradientCurve} from './types.ts'

function layoutSegmentedPills(root: HTMLElement) {
    for (const group of root.querySelectorAll('.clock-theme')) {
        if (!(group instanceof HTMLElement)) continue
        const pill = group.querySelector('.clock-theme-pill')
        const active = group.querySelector('.clock-theme-btn.is-active')
        if (!(pill instanceof HTMLElement) || !(active instanceof HTMLElement)) continue
        pill.style.width = `${active.offsetWidth}px`
        pill.style.transform = `translateX(${active.offsetLeft}px)`
    }
}

function setActiveChoice(buttons: Element[], attr: 'theme' | 'curve', value: string) {
    for (const el of buttons) {
        if (!(el instanceof HTMLElement)) continue
        el.classList.toggle('is-active', el.dataset[attr] === value)
    }
}

export function mountSettings(settings: ClockSettings) {
    const button = mustGetButton('clock-settings-btn')
    const menu = mustGetById('clock-settings-menu')
    const speed = mountSpeedStick(settings, {
        sync: mustGetButton('setting-sync'),
        pause: mustGetButton('setting-pause'),
        realtime: mustGetButton('setting-realtime'),
        stick: mustGetById('setting-stick'),
        knob: mustGetById('setting-stick-knob'),
        speedLabel: mustGetById('setting-speed-label'),
    })

    const setOpen = (open: boolean, restoreFocus = false) => {
        button.classList.toggle('is-open', open)
        menu.classList.toggle('is-open', open)
        button.setAttribute('aria-expanded', String(open))
        if (open) requestAnimationFrame(() => layoutSegmentedPills(menu))
        if (restoreFocus && !open) button.focus()
    }

    const isOpen = () => menu.classList.contains('is-open')

    button.addEventListener('click', (event) => {
        event.stopPropagation()
        setOpen(!isOpen())
    })

    const themeButtons = [...menu.querySelectorAll('[data-theme]')]
    const curveButtons = [...menu.querySelectorAll('[data-curve]')]
    const gradStart = mustGetInput('setting-grad-start')
    const gradEnd = mustGetInput('setting-grad-end')
    const hourBias = mustGetInput('setting-hour-bias')
    const minuteBias = mustGetInput('setting-minute-bias')
    const hourBiasLabel = mustGetById('setting-hour-bias-label')
    const minuteBiasLabel = mustGetById('setting-minute-bias-label')
    const biasSliders = mustGetById('setting-bias-sliders')

    const paintGradientPickers = () => {
        const now = effectiveClockTheme(settings.theme)
        gradStart.value = gradientDisplayHex(
            settings.fractalColorStart,
            settings.gradientForTheme,
            now,
        )
        gradEnd.value = gradientDisplayHex(
            settings.fractalColorEnd,
            settings.gradientForTheme,
            now,
        )
    }

    const paintTheme = () => {
        setActiveChoice(themeButtons, 'theme', settings.theme)
        layoutSegmentedPills(menu)
        paintGradientPickers()
    }

    const paintBias = () => {
        hourBias.value = settings.hourBias.toFixed(2)
        minuteBias.value = settings.minuteBias.toFixed(2)
        hourBiasLabel.textContent = settings.hourBias.toFixed(2)
        minuteBiasLabel.textContent = settings.minuteBias.toFixed(2)
        biasSliders.classList.toggle('is-open', settings.gradientCurve === 'biased')
    }

    const paintCurve = () => {
        setActiveChoice(curveButtons, 'curve', settings.gradientCurve)
        paintBias()
    }

    paintTheme()
    paintCurve()

    for (const el of themeButtons) {
        el.addEventListener('click', () => {
            if (!(el instanceof HTMLElement)) return
            const next = el.dataset.theme
            if (next !== 'light' && next !== 'dark' && next !== 'system') return
            const theme: ClockTheme = next
            settings.theme = theme
            applyClockTheme(theme)
            saveClockTheme(theme)
            paintTheme()
        })
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (settings.theme !== 'system') return
        applyClockTheme('system')
        paintGradientPickers()
    })

    const commitPicker = (which: 'start' | 'end', value: string) => {
        if (which === 'start') settings.fractalColorStart = value
        else settings.fractalColorEnd = value
        settings.gradientForTheme = effectiveClockTheme(settings.theme)
        saveFractalGradient(settings)
    }
    gradStart.addEventListener('input', () => commitPicker('start', gradStart.value))
    gradEnd.addEventListener('input', () => commitPicker('end', gradEnd.value))

    const bindBias = (
        input: HTMLInputElement,
        label: HTMLElement,
        key: 'hourBias' | 'minuteBias',
        fallback: number,
    ) => {
        input.addEventListener('input', () => {
            settings[key] = clampBias(Number(input.value), fallback)
            label.textContent = settings[key].toFixed(2)
            input.value = settings[key].toFixed(2)
            saveFractalGradient(settings)
        })
    }
    bindBias(hourBias, hourBiasLabel, 'hourBias', DEFAULT_HOUR_BIAS)
    bindBias(minuteBias, minuteBiasLabel, 'minuteBias', DEFAULT_MINUTE_BIAS)

    for (const el of curveButtons) {
        el.addEventListener('click', () => {
            if (!(el instanceof HTMLElement)) return
            const next = el.dataset.curve
            if (next !== 'linear' && next !== 'proportional' && next !== 'biased') return
            const curve: GradientCurve = next
            settings.gradientCurve = curve
            paintCurve()
            layoutSegmentedPills(menu)
            saveFractalGradient(settings)
        })
    }

    layoutSegmentedPills(menu)

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
        speed.refresh()
        requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
}
