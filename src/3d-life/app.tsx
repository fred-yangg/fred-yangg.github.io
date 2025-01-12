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
    });

    return <Scene/>;
};
