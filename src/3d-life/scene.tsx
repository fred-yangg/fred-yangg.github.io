import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const Scene: React.FC = () => {
    const mountRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Set up scene, camera, and renderer
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true; // Enable shadow maps

        mountRef.current.appendChild(renderer.domElement);

        // Set up scene background
        scene.background = new THREE.Color(0xffffff);
        
        // Add a light that casts shadows
        const light = new THREE.DirectionalLight(0xffffff, 20);
        light.position.set(5, 5, 5); // Position the light
        light.castShadow = true; // Enable shadows for the light
        scene.add(light);

        // Configure shadow properties for the light
        light.shadow.mapSize.width = 1024; // Shadow quality
        light.shadow.mapSize.height = 1024;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 50;

        // Add a cube
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            metalness: 1,
            roughness: 0.3
        });
        const cube = new THREE.Mesh(geometry, material);
        cube.castShadow = true; // Enable casting shadows
        scene.add(cube);
        

        // Add a plane to receive shadows
        const textureLoader = new THREE.TextureLoader();
        const noiseTexture = textureLoader.load('../common/dirt.jpg');
        
        const planeGeometry = new THREE.PlaneGeometry(10, 10);
        const planeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            map: noiseTexture
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2; // Rotate the plane to be horizontal
        plane.position.y = -1; // Position the plane below the cube
        plane.receiveShadow = true; // Enable receiving shadows
        scene.add(plane);

        camera.position.z = 5;

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup on component unmount
        return () => {
            renderer.dispose();
            if (mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    return <div ref={mountRef} />;
};

export default Scene;