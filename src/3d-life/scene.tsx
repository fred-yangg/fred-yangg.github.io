import { useEffect, useRef } from 'react';
import animateScene from './animateScene';
import { GosperGliderGun } from './gridPresets';
import { RENDER_PADDING } from './constants';
import { padGrid } from './life';
import state from './state';

const Scene = () => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    
    useEffect(() => {
        const div = mountRef.current;
        if (!div) return;

        state.grid = GosperGliderGun;
        state.grid = padGrid(state.grid, RENDER_PADDING);
    
        animateScene(div);
    }, []);

    return <div 
        ref={mountRef}
    />;
};

export default Scene;