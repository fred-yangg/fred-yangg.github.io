import {useEffect, useRef} from 'react';
import animateScene from './animateScene';

const Scene = () => {
    const mountRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const div = mountRef.current;
        if (!div) return;
        return animateScene(div);
    }, []);

    return <div ref={mountRef} className="absolute inset-0"/>;
};

export default Scene;
