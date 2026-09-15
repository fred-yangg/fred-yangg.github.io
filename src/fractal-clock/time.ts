import type {Hand} from './types.ts'

export function hourFromDate(date = new Date()) {
    return (
        (date.getHours() % 12)
        + date.getMinutes() / 60
        + date.getSeconds() / 3600
        + date.getMilliseconds() / 3_600_000
    )
}

export function wrapHour(hour: number) {
    return ((hour % 12) + 12) % 12
}

export function formatDigitalTime(hour: number) {
    const wrapped = wrapHour(hour)
    const totalMinutes = wrapped * 60
    const h = Math.floor(totalMinutes / 60) % 12 || 12
    const m = Math.floor(totalMinutes % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function updateTimeAngles(
    hands: Hand[],
    hour: number,
    discreteHourHand = false,
    discreteHourStep = 60,
) {
    const wrapped = wrapHour(hour)
    const minute = (wrapped * 60) % 60
    const [hourHand, minuteHand] = hands
    const stepHours = Math.max(1, discreteHourStep) / 60
    const hourValue = discreteHourHand
        ? Math.floor(wrapped / stepHours + 1e-9) * stepHours
        : wrapped
    hourHand.angle = (hourValue / 12) * Math.PI * 2
    minuteHand.angle = (minute / 60) * Math.PI * 2
}
