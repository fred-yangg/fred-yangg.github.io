/* Script for fractal-clock.html */

//GLOBALS
var canvas, ctx;
var xCenter, yCenter;
var hourAngle = new NumberContainer(0);
var minuteAngle = new NumberContainer(0);
var secondAngle = new NumberContainer(0);
var secondHand, minuteHand, hourHand;
const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const DOWNSCALE = 1/Math.sqrt(2);

function updateTimeAngles() {
    var date = new Date();
    var millisecond = date.getMilliseconds();
    var second = date.getSeconds() + millisecond / 1000;
    var minute = date.getMinutes() + second / 60;
    var hour = date.getHours() + minute / 60;

    hourAngle.value = hour / 24 * TWO_PI;
    minuteAngle.value = minute / 60 * TWO_PI;
    secondAngle.value = second / 60 * TWO_PI;
}


function setup() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    updateWindowDimensions();

    secondHand = new Hand(1,6,secondAngle,100);
    minuteHand = new Hand(1,6,minuteAngle,100);

    draw();
    setInterval(draw, 11);
}


function draw() {
    updateWindowDimensions();

    updateTimeAngles();

    ctx.translate(xCenter,yCenter);
    ctx.save();
    secondHand.draw();
    minuteHand.draw();

    // //test second hand

    // ctx.save();
    // ctx.rotate(secondAngle.value);
    // ctx.moveTo(0, 0);
    // ctx.lineTo(0, -100);
    // ctx.restore();

    // //test minute hand

    // ctx.save();
    // ctx.rotate(minuteAngle.value);
    // ctx.moveTo(0, 0);
    // ctx.lineTo(0, -100);
    // ctx.restore();

    // ctx.stroke();
    // ctx.restore();
}


function updateWindowDimensions() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    xCenter = canvas.width / 2;
    yCenter = canvas.height / 2;
}


setup();
