import P5 from 'p5'

type Hand = {
    enabled: boolean
    angle: number
    weight: number
}

const SCALE = 1 / Math.SQRT2
const MIN_FEATURE_PX = 0.5
const MAX_DEPTH = 32

function updateTimeAngles(hands: Hand[]) {
    const date = new Date()
    const millisecond = date.getMilliseconds()
    const second = date.getSeconds() + millisecond / 1000
    const minute = date.getMinutes() + second / 60
    const hour = date.getHours() + minute / 60

    const [hourHand, minuteHand, secondHand] = hands
    hourHand.angle = ((hour % 12) / 12) * Math.PI * 2
    minuteHand.angle = (minute / 60) * Math.PI * 2
    secondHand.angle = (second / 60) * Math.PI * 2
}

function maxDepth(handLength: number) {
    if (handLength <= MIN_FEATURE_PX) return 1
    return Math.max(
        1,
        Math.min(
            MAX_DEPTH,
            Math.ceil(Math.log(MIN_FEATURE_PX / handLength) / Math.log(SCALE)),
        ),
    )
}

function bufferSize(handLength: number) {
    const radius = handLength * SCALE / (1 - SCALE)
    return Math.max(2, Math.ceil(2 * radius + 16))
}

function drawNumbers(p: P5, numberRadius: number) {
    p.strokeWeight(3)
    p.fill(255)
    p.circle(0, 0, numberRadius * 2 + 60)
    p.fill(0)
    for (let i = 1; i <= 12; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 6
        p.text(i, numberRadius * Math.cos(angle), numberRadius * Math.sin(angle))
    }
}

export function startClock(container: HTMLElement) {
    const hands: Hand[] = [
        {enabled: false, angle: 0, weight: 4},
        {enabled: true, angle: 0, weight: 4},
        {enabled: true, angle: 0, weight: 4},
    ]

    let xCenter = 0
    let yCenter = 0
    let handLength = 0
    let numberRadius = 0
    let observer: ResizeObserver | undefined
    let bufA: ReturnType<P5['createGraphics']> | undefined
    let bufB: ReturnType<P5['createGraphics']> | undefined

    const instance = new P5((p: P5) => {
        const layout = () => {
            xCenter = p.width / 2
            yCenter = p.height / 2
            handLength = Math.min(p.width, p.height) / 5
            numberRadius = handLength * 2
        }

        const makeBuffer = (size: number) => {
            const g = p.createGraphics(size, size)
            g.pixelDensity(p.pixelDensity())
            g.imageMode(p.CENTER)
            g.noFill()
            return g
        }

        const ensureBuffers = () => {
            const size = bufferSize(handLength)
            if (bufA && bufB && bufA.width === size && bufB.width === size) return
            bufA?.remove()
            bufB?.remove()
            bufA = makeBuffer(size)
            bufB = makeBuffer(size)
        }

        const renderFractal = () => {
            ensureBuffers()
            const src0 = bufA
            const dst0 = bufB
            if (!src0 || !dst0) return src0

            src0.clear()
            let src = src0
            let dst = dst0
            const depth = maxDepth(handLength)

            for (let i = 0; i < depth; i++) {
                dst.clear()
                dst.stroke(0)
                dst.push()
                dst.translate(dst.width / 2, dst.height / 2)
                for (const {enabled, angle, weight} of hands) {
                    if (!enabled) continue
                    dst.push()
                    dst.scale(SCALE)
                    dst.rotate(angle)
                    dst.strokeWeight(weight)
                    dst.line(0, 0, 0, -handLength)
                    dst.translate(0, -handLength)
                    dst.image(src, 0, 0)
                    dst.pop()
                }
                dst.pop()
                const prev = src
                src = dst
                dst = prev
            }

            return src
        }

        const syncSize = () => {
            const w = container.clientWidth
            const h = container.clientHeight
            if (w < 1 || h < 1) return
            if (w !== p.width || h !== p.height) {
                p.resizeCanvas(w, h)
            }
            layout()
            ensureBuffers()
        }

        p.setup = () => {
            const w = Math.max(container.clientWidth, 1)
            const h = Math.max(container.clientHeight, 1)
            p.createCanvas(w, h)
            p.pixelDensity(p.displayDensity())
            p.imageMode(p.CENTER)
            p.textFont('Courier New')
            p.textSize(36)
            p.textAlign(p.CENTER, p.CENTER)
            layout()
            ensureBuffers()

            observer = new ResizeObserver(syncSize)
            observer.observe(container)
        }

        p.draw = () => {
            updateTimeAngles(hands)
            const fractal = renderFractal()
            p.background(255)
            p.push()
            p.translate(xCenter, yCenter)
            drawNumbers(p, numberRadius)
            if (fractal) p.image(fractal, 0, 0)
            p.pop()
        }
    }, container)

    return () => {
        observer?.disconnect()
        bufA?.remove()
        bufB?.remove()
        instance.remove()
    }
}
