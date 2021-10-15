/* Script for fractal_clock.html */

//GLOBALS
var canvas, ctx;
var xCenter, yCenter;
var hourAngle = 0;
var minuteAngle = 0;
var secondAngle = 0;
const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;

function updateTimeAngles() {
    var date = new Date();
    var millisecond = date.getMilliseconds();
    var second = date.getSeconds() + millisecond / 1000;
    var minute = date.getMinutes() + second / 60;
    var hour = date.getHours() + minute / 60;

    hourAngle = hour / 24 * TWO_PI;
    minuteAngle = minute / 60 * TWO_PI;
    secondAngle = second / 60 * TWO_PI;

    console.log(secondAngle);
}


function setup() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    setInterval(draw, 11);
}


function draw() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    xCenter = canvas.width / 2;
    yCenter = canvas.height / 2;

    //test second hand

    ctx.save();
    ctx.translate(xCenter,yCenter);
    ctx.rotate(secondAngle);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -100);
    ctx.restore();

    //test minute hand

    ctx.save();
    ctx.translate(xCenter,yCenter);
    ctx.rotate(minuteAngle);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -100);
    ctx.restore();


    ctx.stroke();

    updateTimeAngles();
}

setup();