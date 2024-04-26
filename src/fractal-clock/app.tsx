import {useEffect, useLayoutEffect, useRef} from "preact/hooks";

import './app.css'
import {sketch} from "./fractalClock.ts";
import P5 from "p5";

export function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return;
        [canvas.width, canvas.height] = [canvas.clientWidth, canvas.clientHeight]


        const resizeObserver = new ResizeObserver(() => {
            const canvas = canvasRef.current
            if (!canvas) return;
            [canvas.width, canvas.height] = [canvas.clientWidth*3, canvas.clientHeight*3]
            console.log("resize")
            console.log(canvas.clientWidth, canvas.clientHeight)
            console.log(canvas.width, canvas.height)
        });

        resizeObserver.observe(canvas)

        return () => {
            // cleanup by removing from ResizeObserver
            resizeObserver.disconnect();
        };
    })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return;
        const myP5 = new P5(sketch, canvas);
        canvas.style.width = "100%"
        return () => {
            myP5.remove();
        };
    })

    return (
        <>
            <div></div>
            <canvas id="clock-canvas" ref={canvasRef} ></canvas>
            <div></div>
        </>
    )
}
