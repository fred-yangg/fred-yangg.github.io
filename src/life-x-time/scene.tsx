import { useEffect, useRef } from 'react';
import animateScene from './animateScene';
import { GosperGliderGun } from './gridPresets';
import { liveFromGrid } from './life';
import state from './state';

const Scene = () => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    
    useEffect(() => {
        const div = mountRef.current;
        if (!div) return;

        state.live = liveFromGrid(GosperGliderGun);
    
        animateScene(div);
    }, []);

    return <div 
        ref={mountRef}
    />;
};

export default Scene;
