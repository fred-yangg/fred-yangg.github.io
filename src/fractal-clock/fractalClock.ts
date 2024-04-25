import P5 from "p5";

type NumberContainer = {
    value: number
}

type HandParams = {
    enabled: boolean
    angle: NumberContainer
}

let xCenter: number;
let yCenter: number;
let handLength = 140;
let hourAngle: NumberContainer = {value: 0};
let minuteAngle: NumberContainer = {value: 0};
let secondAngle: NumberContainer = {value: 0};
const handParams: HandParams[] = [
    {enabled: false, angle: hourAngle},
    {enabled: true, angle: minuteAngle},
    {enabled: true, angle: secondAngle},
];


function updateTimeAngles() {
    const date = new Date();
    const millisecond = date.getMilliseconds();
    const second = date.getSeconds() + millisecond / 1000;
    const minute = date.getMinutes() + second / 60;
    const hour = date.getHours() + minute / 60;

    hourAngle.value = hour / 24 * Math.PI * 2;
    minuteAngle.value = minute / 60 * Math.PI * 2;
    secondAngle.value = second / 60 * Math.PI * 2;
}

const drawClock = (p: P5, depth: number) => {
    if (depth === 0) {
        return;
    }

    handParams.forEach((({enabled, angle}) => {
        if (enabled) {
            p.push();
            p.scale(1 / Math.sqrt(2));
            p.rotate(angle.value);
            p.line(0, 0, 0, -handLength);

            p.translate(0, -handLength);

            drawClock(p, depth - 1);

            p.pop();
        }
    }));
};

const handleResize = (w: number, h: number) => {
    xCenter = w / 2;
    yCenter = h / 2;
    handLength = Math.min(w, h) / 5;
};

const sketch = (p: P5) => {
    p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        handleResize(p.windowWidth, p.windowHeight);
    };

    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        handleResize(p.windowWidth, p.windowHeight);
    };

    p.draw = () => {
        p.background(255);

        updateTimeAngles();

        p.push();
        p.strokeWeight(4);
        p.translate(xCenter, yCenter);
        drawClock(p, 12);
        p.pop();
    };
};

new P5(sketch);
