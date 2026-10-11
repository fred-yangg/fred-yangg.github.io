import {useEffect} from 'react';
import {Controls} from './controls';
import Scene from './scene';
import state, {emit} from './state';

export const App = () => {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== ' ' || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
            event.preventDefault();
            state.paused = !state.paused;
            emit();
        };
        const onHide = () => {
            state.inactive = document.hidden;
        };
        window.addEventListener('keyup', onKey);
        window.addEventListener('visibilitychange', onHide);
        return () => {
            window.removeEventListener('keyup', onKey);
            window.removeEventListener('visibilitychange', onHide);
        };
    }, []);

    return (
        <div className="relative h-screen w-screen overflow-hidden">
            <Scene/>
            <Controls/>
        </div>
    );
};
