import { useEffect, useRef } from "react";

export const App = () => {
    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://not-fl3.github.io/miniquad-samples/mq_js_bundle.js";
        script.onload = () => {
            (window as any).load("/optimized.wasm");
        };
        document.body.appendChild(script);
    }, []);

    return (
        <canvas
            id="glcanvas"
            tabIndex={1}
            style={{ display: "block", width: "100%", height: "100vh", background: "black" }}
        />
    );
};