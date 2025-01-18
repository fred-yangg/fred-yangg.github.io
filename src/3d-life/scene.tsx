import { useEffect, useRef } from 'react';
import animateScene from './animateScene';
import { GosperGliderGun } from './gridPresets';
import { RENDER_PADDING } from './constants';
import { padGrid } from './life';
import state from './state';

const Scene = () => {
    const mountRef = useRef<HTMLCanvasElement | null>(null);
    
    useEffect(() => {
        const canvas = mountRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        state.grid = GosperGliderGun;
        state.grid = padGrid(state.grid, RENDER_PADDING);
    
        animateScene(canvas);
    }, []);

    return <canvas 
        ref={mountRef}
    />;
};

export default Scene;