import P5 from "p5";

type HandProps = {
    enabled: boolean
    angle: number
    weight: number
}

enum Hand {
    HOUR,
    MINUTE,
    SECOND,
}

let xCenter: number;
let yCenter: number;
let handLength = 0;
let numberRadius = 0;
const allHandParams: HandProps[] = [
    {enabled: false, angle: 0, weight: 4},
    {enabled: true, angle: 0, weight: 4},
    {enabled: true, angle: 0, weight: 4},
];


function updateTimeAngles() {
    const date = new Date();
    const millisecond = date.getMilliseconds();
    const second = date.getSeconds() + millisecond / 1000;
    const minute = date.getMinutes() + second / 60;
    const hour = date.getHours() + minute / 60;

    allHandParams[Hand.HOUR].angle = hour / 24 * Math.PI * 2;
    allHandParams[Hand.MINUTE].angle = minute / 60 * Math.PI * 2;
    allHandParams[Hand.SECOND].angle = second / 60 * Math.PI * 2;
}

const drawClock = (p: P5, depth: number) => {
    if (depth === 0) {
        return;
    }

    allHandParams.forEach((({enabled, angle, weight}) => {
        if (enabled) {
            p.push();
            p.scale(1 / Math.sqrt(2));
            p.rotate(angle);

            p.strokeWeight(weight);
            p.line(0, 0, 0, -handLength);

            p.translate(0, -handLength);

            drawClock(p, depth - 1);

            p.pop();
        }
    }));
};

const drawNumbers = (p: P5) => {
    p.strokeWeight(3)
    p.fill(255)
    p.circle(0,0,numberRadius*2+60)
    p.fill(0)
    for (let i = 1; i <= 12; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 6;
        const x = numberRadius * Math.cos(angle);
        const y = numberRadius * Math.sin(angle);
        p.textFont("Courier New");
        p.textSize(36);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(i, x, y);
    }
};

const handleResize = (w: number, h: number) => {
    xCenter = w / 2;
    yCenter = h / 2;
    handLength = Math.min(w, h) / 5;
    numberRadius = handLength * 2;
};

export const sketch = (p: P5) => {
    let canvas: HTMLCanvasElement;

    p.setup = () => {
        canvas = document.getElementById("clock-canvas") as HTMLCanvasElement;
        p.createCanvas(canvas.clientWidth, canvas.clientHeight, canvas);
        canvas.style.width = "100%";
        canvas.style.height = "0";
        handleResize(p.width, p.height);
    };


    p.draw = () => {
        p.resizeCanvas(canvas.clientWidth, canvas.clientHeight);
        canvas.style.width = "100%";
        canvas.style.height = "0";
        handleResize(p.width, p.height);
        p.background(255);

        updateTimeAngles();

        p.push();
        p.translate(xCenter, yCenter);
        drawNumbers(p);
        drawClock(p, 10);
        p.pop();
        console.log(p.width, p.height);
    };
};
