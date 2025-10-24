import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

import TWEEN from "@tweenjs/tween.js";

const container = document.querySelector('#threejs_container');

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

const raycaster = new THREE.Raycaster();

let camera, scene, renderer, effect;
let mixer;
const mouse = new THREE.Vector2();
let particleLight;
let composer, customOutline, surfaceFinder;

const raycast_objects = [];
let paintedObjects = new Map(); // Track painted progress

const clock = new THREE.Clock();

init();

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color().setHSL(0.6, 0, 1);
    scene.fog = new THREE.Fog(scene.background, 1, 5000);

    // Renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    container.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;

    // Camera
    camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 300, 700);
    camera.lookAt(scene.position);

    effect = new OutlineEffect(renderer);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    //controls.enableRotate = false;

    container.addEventListener("pointerdown", function (e) {
        onDocumentMouseDown(e);
    }, false);
    container.addEventListener("pointermove", function (e) {    
        onDocumentMouseMove(e);
    }, false);

    // Environment
    createEnvironment();

    // Create scene
    createScene();

    window.addEventListener('resize', onWindowResize);
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    camera.lookAt(scene.position);

    renderer.setSize(window.innerWidth, window.innerHeight);
};

function setMousePosition(event) {
    const top = container.getBoundingClientRect().y;

    if (!event.targetTouches) {
        mouse.set(
            (event.clientX / (window.innerWidth) * 2 - 1),
            -((event.clientY - top) / (window.innerHeight)) * 2 + 1
        );
    } else {
        mouse.x = +(event.targetTouches[0].pageX / (window.innerWidth)) * 2 + -1;
        mouse.y = -((event.targetTouches[0].pageY - top) / window.innerHeight) * 2 + 1;
    };
};

function onDocumentMouseDown(e) {
    setMousePosition(e);
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(raycast_objects, false);
    if (intersects.length > 0) {
        console.log('Intersect', intersects[0].object);
        paintWithSpread(intersects[0].object, intersects[0].point);
    };
};

function onDocumentMouseMove(e) {
    setMousePosition(e);
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(raycast_objects, false);
    if (intersects.length > 0) {
        container.style.cursor = 'pointer';
    } else {
        container.style.cursor = 'default';
    };
};

function animate(time) {
    const delta = clock.getDelta();

    TWEEN.update(time);

    if (mixer) {
        mixer.update(delta);
    };

    /*
    particleLight.position.x = Math.sin(delta * 7) * 300;
    particleLight.position.y = Math.cos(delta * 5) * 400;
    particleLight.position.z = Math.cos(delta * 3) * 300;
    */

    //renderer.render(scene, camera);
    effect.render(scene, camera);

};

function createEnvironment() {
    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
    hemiLight.color.setHSL(0.6, 1, 0.6);
    hemiLight.groundColor.setHSL(0.095, 1, 0.75);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    //scene.add(new THREE.AmbientLight(0xffffff, 1));

    const pointLight = new THREE.PointLight(0xffffff, 2, 800, 0);
    pointLight.position.set(0, 100, 0);
    scene.add(pointLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(10000, 10000);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    groundMat.color.setHSL(0.095, 1, 0.75);

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = - 33;
    ground.rotation.x = - Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Sky
    const vertexShader = document.getElementById('vertexShader').textContent;
    const fragmentShader = document.getElementById('fragmentShader').textContent;
    const uniforms = {
        'topColor': { value: new THREE.Color(0x0077ff) },
        'bottomColor': { value: new THREE.Color(0xffffff) },
        'offset': { value: 33 },
        'exponent': { value: 0.6 }
    };
    uniforms['topColor'].value.copy(hemiLight.color);

    scene.fog.color.copy(uniforms['bottomColor'].value);

    const skyGeo = new THREE.SphereGeometry(4000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    //scene.add(sky);
}

function createScene() {
    const geo_cube = new THREE.SphereGeometry(5);
    const cube = new THREE.Mesh(geo_cube, new THREE.MeshToonMaterial({ color: 0xffffff }));
    cube.userData.targetColor = new THREE.Color(0xff0000);
    //cube.castShadow = true;
    //cube.receiveShadow = true;
    raycast_objects.push(cube);

    const white_mat = new THREE.MeshToonMaterial({ color: 0xffffff });

    loader.load('nest.glb', function (glb) {
        console.log('glb', glb);
        scene.add(glb.scene);
        glb.scene.traverse((node) => {
            if (node.isMesh) {
                node.material = white_mat;
            }
        });
    })

    scene.add(cube);
};

function applyPaintingEffect(object) {
    console.log('Applying paint effect to', object);
    const targetColor = object.userData.targetColor;
    const startColor = object.material.color.clone();
    
    // Initialize paint data
    if (!paintedObjects.has(object.uuid)) {
        paintedObjects.set(object.uuid, {
            progress: 0,
            startColor: startColor,
            targetColor: targetColor
        });
    }
    
    const paintData = paintedObjects.get(object.uuid);
    console.log('Paintdata', paintData);
    
    // Animate the color transition
    animatePaint(object, paintData);
};

function paintWithSpread(object, intersectionPoint) {
    console.log('Paint with spread');
    const targetColor = object.userData.targetColor;
    console.log('Target color', targetColor);
    
    // Check if targetColor exists
    if (!targetColor) {
        console.warn('No target color defined for object', object);
        return;
    }
    
    // Get geometry vertices
    const geometry = object.geometry;
    const positions = geometry.attributes.position;
    
    // Create or get vertex colors
    if (!geometry.attributes.color) {
        const colors = new Float32Array(positions.count * 3);
        // Initialize with white
        for (let i = 0; i < positions.count; i++) {
            colors[i * 3] = 1;     // R
            colors[i * 3 + 1] = 1; // G
            colors[i * 3 + 2] = 1; // B
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Clone material if needed and enable vertex colors
        if (!object.material.vertexColors) {
            object.material = object.material.clone();
            object.material.vertexColors = true;
            object.material.needsUpdate = true;
        }
    }
    
    const colors = geometry.attributes.color;
    const worldPoint = intersectionPoint.clone();
    
    // Calculate maximum distance to any vertex (for knowing when to stop)
    let maxDistance = 0;
    const vertexDistances = [];
    
    for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
            positions.getX(i),
            positions.getY(i),
            positions.getZ(i)
        );
        vertex.applyMatrix4(object.matrixWorld);
        const distance = vertex.distanceTo(worldPoint);
        vertexDistances.push(distance);
        maxDistance = Math.max(maxDistance, distance);
    }
    
    // Animation parameters
    const spreadDuration = 2000; // 2 seconds to fully spread
    const startTime = Date.now();
    const spreadSpeed = maxDistance / spreadDuration;
    
    function animateSpread() {
        const elapsed = Date.now() - startTime;
        const currentRadius = (elapsed / spreadDuration) * maxDistance;
        
        // Paint vertices within current radius
        for (let i = 0; i < positions.count; i++) {
            const distance = vertexDistances[i];
            
            if (distance <= currentRadius) {
                // Calculate how far along this vertex should be painted
                const timeSinceReached = currentRadius - distance;
                const paintProgress = Math.min(timeSinceReached / (maxDistance * 0.2), 1);
                
                // Get current color
                const currentR = colors.getX(i);
                const currentG = colors.getY(i);
                const currentB = colors.getZ(i);
                
                // Smoothly blend to target color
                colors.setXYZ(
                    i,
                    THREE.MathUtils.lerp(currentR, targetColor.r, paintProgress * 0.15),
                    THREE.MathUtils.lerp(currentG, targetColor.g, paintProgress * 0.15),
                    THREE.MathUtils.lerp(currentB, targetColor.b, paintProgress * 0.15)
                );
            }
        }
        
        colors.needsUpdate = true;
        
        // Continue animation until fully spread
        if (elapsed < spreadDuration + 1000) {
            requestAnimationFrame(animateSpread);
        }
    }
    
    animateSpread();
}

// Smooth animation function
function animatePaint(object, paintData) {
    const duration = 1000; // 1 second
    const startTime = Date.now();
    
    function animating() {
        console.log('Animating paint', paintData);
        const elapsed = Date.now() - startTime;
        paintData.progress = Math.min(elapsed / duration, 1);
        
        // Lerp between start and target color
        object.material.color.lerpColors(
            paintData.startColor,
            paintData.targetColor,
            paintData.progress
        );
        
        if (paintData.progress < 1) {
            requestAnimationFrame(animating);
        }
    }
    
    animating();
}