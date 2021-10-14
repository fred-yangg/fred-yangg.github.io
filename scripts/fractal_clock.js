// Script for fractal_clock.html


function setup() {
    setInterval(draw, 33);
}

function draw() {
    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.moveTo(0, 0);
    ctx.lineTo(window.innerWidth, window.innerHeight);
    ctx.stroke();
}

setup();