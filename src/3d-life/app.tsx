import { useEffect } from 'preact/hooks';
import Scene from './scene';
import state from './state';

export const App = () => {
    useEffect(() => {
        window.addEventListener('keyup', (event) => {
            console.log(event)
            if (event.key === ' ') {
                state.paused = !state.paused;
            }
        });

        window.addEventListener('wheel', (event) => {
            state.scale *= (1 - event.deltaY/1000);
        });
    });

    return <Scene/>;
};
