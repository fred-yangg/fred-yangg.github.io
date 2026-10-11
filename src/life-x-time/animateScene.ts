import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {bounds, nextGeneration, population, retain, walkLod, type Bounds, type Universe} from './life';
import {loadPreset} from './patterns';
import state, {emit} from './state';
import {MAX_TRAIL_LENGTH} from './constants';

const FACE_COLORS = [0xE06020, 0xE0A000, 0xE0D000, 0x603060, 0xC02050, 0xC02050];
const INSTANCE_BUDGET = 20000;
const MAX_HISTORY = 600;
const BUILDS_PER_FRAME = 3;

const createCubeGeometry = () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const color = new THREE.Color();
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let face = 0; face < 6; face++) {
        color.setHex(FACE_COLORS[face]);
        for (let vertex = 0; vertex < 4; vertex++) {
            color.toArray(colors, (face * 4 + vertex) * 3);
        }
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.clearGroups();
    return geometry;
};

type CachedLayer = {mesh: THREE.InstancedMesh; minSize: number};

const animateScene = (div: HTMLDivElement) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF);
    scene.fog = new THREE.Fog(0xFFFFFF, MAX_TRAIL_LENGTH * 0.5, MAX_TRAIL_LENGTH * 0.92);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(-aspect * 5, aspect * 5, 5, -5, -8000, 8000);
    camera.position.set(80, 70, 80);

    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(width, height);
    div.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.update();

    const cubeGeometry = createCubeGeometry();
    const cubeMaterial = new THREE.MeshBasicMaterial({vertexColors: true, fog: true});
    cubeMaterial.customProgramCacheKey = () => 'life-height-fog';
    cubeMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
            '#include <fog_vertex>',
            `
#ifdef USE_FOG
    vec4 fogWorldPosition = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
        fogWorldPosition = instanceMatrix * fogWorldPosition;
    #endif
    fogWorldPosition = modelMatrix * fogWorldPosition;
    vFogDepth = -fogWorldPosition.y;
#endif
            `,
        );
    };

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    const meshes = new Map<number, CachedLayer>();
    let history: Universe[] = [];
    let base = 0;
    let displayTime = 0;
    let seenReset = -1;
    let running = true;
    let lastEmit = -1;

    const latest = () => base + history.length - 1;

    const disposeMesh = (gen: number) => {
        const cached = meshes.get(gen);
        if (!cached) return;
        scene.remove(cached.mesh);
        cached.mesh.dispose();
        meshes.delete(gen);
    };

    const clearMeshes = () => {
        for (const gen of [...meshes.keys()]) disposeMesh(gen);
    };

    const framePattern = (box: Bounds) => {
        const span = Math.max(box.maxX - box.minX + 1, box.maxY - box.minY + 1, 16);
        const cx = (box.minX + box.maxX) / 2;
        const cz = (box.minY + box.maxY) / 2;
        const view = Math.min(camera.right - camera.left, camera.top - camera.bottom);
        camera.zoom = view / (span * 1.45);
        const clip = Math.max(8000, span * 8);
        camera.near = -clip;
        camera.far = clip;
        camera.updateProjectionMatrix();
        controls.target.set(cx, 0, cz);
        camera.position.set(cx + span, span * 0.7, cz + span);
        controls.update();
    };

    const buildLayer = (universe: Universe, minSize: number) => {
        const items: {x: number; y: number; size: number; population: number}[] = [];
        walkLod(universe, minSize, INSTANCE_BUDGET, (x, y, size, count) => {
            items.push({x, y, size, population: count});
        });
        if (items.length === 0) return null;
        const mesh = new THREE.InstancedMesh(cubeGeometry, cubeMaterial, items.length);
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            const footprint = item.size * 0.96;
            const thick = Math.min(item.size, 1) * 0.96;
            dummy.position.set(item.x + item.size / 2, 0, item.y + item.size / 2);
            dummy.scale.set(footprint, thick, footprint);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
            if (item.size <= 1) tint.setRGB(1, 1, 1);
            else {
                const density = Math.min(1, (item.population / (item.size * item.size)) * 6);
                tint.setRGB(1, 0.55 + density * 0.45, 0.35 + density * 0.4);
            }
            mesh.setColorAt(index, tint);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        return mesh;
    };

    const placeLayer = (
        mesh: THREE.Object3D,
        gen: number,
        playhead: number,
        oldest: number,
        frac: number,
        stride: number,
    ) => {
        if (stride === 1) {
            const count = playhead - oldest + 1;
            const index = gen - oldest;
            let y = index - count - frac;
            let scaleY = 1;
            if (gen === playhead) {
                scaleY = Math.max(frac, 0.02);
                y += scaleY / 2 - 0.5;
            } else if (count >= MAX_TRAIL_LENGTH && gen === oldest) {
                scaleY = Math.max(1 - frac, 0.02);
                y += frac / 2;
            }
            mesh.position.y = y;
            mesh.scale.y = scaleY;
            return;
        }
        const scaleY = gen === playhead ? Math.max(frac, 0.05) * stride : stride;
        mesh.scale.y = scaleY;
        mesh.position.y = (gen - playhead) - frac;
        if (gen === playhead) mesh.position.y += scaleY / 2 - stride / 2;
    };

    const publish = (force: boolean) => {
        const shown = Math.floor(displayTime);
        if (!force && shown === lastEmit) return;
        lastEmit = shown;
        state.displayTime = displayTime;
        state.baseGen = base;
        state.latestGen = latest();
        const visible = history[Math.max(0, Math.min(history.length - 1, Math.floor(displayTime) - base))];
        state.population = visible ? population(visible) : 0;
        state.loading = false;
        emit();
    };

    const reset = () => {
        clearMeshes();
        const universe = loadPreset(state.preset);
        history = [universe];
        base = 0;
        displayTime = 0.85;
        retain(history);
        framePattern(bounds(universe));
        publish(true);
    };

    const resize = () => {
        const nextWidth = window.innerWidth;
        const nextHeight = window.innerHeight;
        const nextAspect = nextWidth / nextHeight;
        camera.left = -nextAspect * 5;
        camera.right = nextAspect * 5;
        camera.top = 5;
        camera.bottom = -5;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight);
    };
    window.addEventListener('resize', resize);

    let lastTime = performance.now();
    const animate = () => {
        if (!running) return;
        const now = performance.now();
        const timeDelta = now - lastTime;
        lastTime = now;

        if (state.resetToken !== seenReset) {
            seenReset = state.resetToken;
            reset();
        }

        if (state.scrubbing && state.scrubTo !== null) {
            const target = Math.max(base, Math.min(latest(), state.scrubTo));
            displayTime = target + 0.999;
        } else if (!state.paused && !state.inactive) {
            displayTime += (timeDelta / 1000) * state.speed;
            let steps = 0;
            while (latest() < Math.floor(displayTime) && steps < 4) {
                history.push(nextGeneration(history[history.length - 1]));
                while (history.length > MAX_HISTORY) {
                    disposeMesh(base);
                    history.shift();
                    base++;
                }
                retain(history);
                steps++;
            }
            if (displayTime > latest() + 0.999) displayTime = latest() + 0.999;
        }

        controls.update();
        const pixels = Math.max(1, renderer.domElement.clientWidth);
        const rawPixel = (camera.right - camera.left) / (camera.zoom * pixels);
        const coarse = rawPixel >= 1.25;
        const minSize = coarse ? 2 ** Math.round(Math.log2(rawPixel)) : 1;
        const stride = coarse ? Math.max(1, Math.round(rawPixel)) : 1;
        const playhead = Math.max(base, Math.min(latest(), Math.floor(displayTime)));
        const frac = displayTime - Math.floor(displayTime);
        const oldest = Math.max(base, playhead - MAX_TRAIL_LENGTH + 1);
        const wanted: number[] = [];
        for (let gen = playhead; gen >= oldest; gen -= stride) wanted.push(gen);
        const wantedSet = new Set(wanted);

        let builds = 0;
        for (const gen of wanted) {
            const cached = meshes.get(gen);
            if (cached && cached.minSize === minSize) continue;
            if (builds >= BUILDS_PER_FRAME) break;
            const universe = history[gen - base];
            if (!universe) continue;
            builds++;
            if (cached) disposeMesh(gen);
            const mesh = buildLayer(universe, minSize);
            if (!mesh) continue;
            scene.add(mesh);
            meshes.set(gen, {mesh, minSize});
        }

        for (const [gen, cached] of meshes) {
            if (!wantedSet.has(gen) || cached.minSize !== minSize) cached.mesh.removeFromParent();
        }
        for (const gen of wanted) {
            const cached = meshes.get(gen);
            if (!cached || cached.minSize !== minSize) continue;
            if (cached.mesh.parent !== scene) scene.add(cached.mesh);
            placeLayer(cached.mesh, gen, playhead, oldest, frac, stride);
        }
        for (const gen of [...meshes.keys()]) {
            if (gen < playhead - MAX_TRAIL_LENGTH - 8 || gen < base) disposeMesh(gen);
        }

        publish(false);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    return () => {
        running = false;
        window.removeEventListener('resize', resize);
        clearMeshes();
        controls.dispose();
        renderer.dispose();
        renderer.domElement.remove();
    };
};

export default animateScene;
