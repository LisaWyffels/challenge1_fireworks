import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dot, cross, norm } from 'https://alikim.com/_v1_jsm/geometry.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { gameData } from './gameData';
import TWEEN from "@tweenjs/tween.js";
import { birdShaders } from './birdShaders';
import { eggShaders } from './eggShaders';


const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

let camera, scene, renderer;
let mixer;
let bird;

const clock = new THREE.Clock();

const bb_nests = [];

let moveSpeed = 2;
let moveDirection = {
    left: false,
    right: false,
    forward: false,
    backward: false,
    up: false,
    down: false
};

let animation_in_progress = false;
let animation_egg_in_progress = false;

// Add these shader definitions at the top of your file


init();

function init() {
    const container = document.querySelector('#threejs_container');

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

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    //controls.enableRotate = false;

    createEnvironment();

    // Add flowers to the scene
    /*
    const flowers = createFlowers();
    scene.add(flowers);
    */

    gameData.birds.forEach((single_bird_data) => {
        const nest = createSingleNest(single_bird_data);
        scene.add(nest);
    });

    spawnRandomBird();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', onWindowResize);
};

function spawnRandomBird() {
    const random_bird_id = getRandomInt(3);
    console.log('random_bird_id', random_bird_id);
    createSingleBird(0, function(bird){
        scene.add(bird);

    });
};

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    camera.lookAt(scene.position);

    renderer.setSize(window.innerWidth, window.innerHeight);
};

function animate(time) {
    const delta = clock.getDelta();

    TWEEN.update(time);

    if (mixer) {
        mixer.update(delta);
    };

    // Move and rotate bird based on key presses
    if (bird) {
        // Store the original position
        const prevPosition = bird.position.clone();

        // Handle movement
        if (moveDirection.left) bird.position.x -= moveSpeed;
        if (moveDirection.right) bird.position.x += moveSpeed;
        if (moveDirection.forward) bird.position.z -= moveSpeed;
        if (moveDirection.backward) bird.position.z += moveSpeed;
        if (moveDirection.up) bird.position.y += moveSpeed;
        if (moveDirection.down) bird.position.y -= moveSpeed;

        // Calculate movement direction
        const movement = bird.position.clone().sub(prevPosition);

        // Only update rotation if the bird is actually moving
        if (movement.length() > 0) {
            // Calculate the angle to rotate to - negated to fix direction
            const angle = -Math.atan2(movement.x, -movement.z);

            // Create a smooth rotation transition
            const currentRotation = bird.rotation.y;
            const targetRotation = angle;

            // Smoothly interpolate between current and target rotation
            bird.rotation.y = currentRotation + (targetRotation - currentRotation) * 0.1;

            // Optional: tilt the bird up/down when moving vertically
            if (moveDirection.up) {
                bird.rotation.x = -0.3; // Tilt up
            } else if (moveDirection.down) {
                bird.rotation.x = 0.3;  // Tilt down
            } else {
                bird.rotation.x = 0;    // Level
            };
        };

        let nest_found = false;
        for (let i = 0; i < bb_nests.length; i++) {
            const bb_nest = bb_nests[i].bb;

            if (bb_nest.containsPoint(bird.position)) {
                nest_found = true;
                if (bb_nests[i].nest.userData.birdId == bird.userData.birdId) {
                    console.log('Nest found');
                    birdLoopAnimation();
                    rightNestAnimation(bb_nests[i]);
                } else {
                    console.log('Wrong nest', bb_nests[i].nest.userData.birdId, bird.userData.birdId);
                    wrongNestAnimations(bb_nests[i]);
                };
            };
        };

        if (!nest_found) {
            animation_in_progress = false;
            animation_egg_in_progress = false;
        };
    };

    renderer.render(scene, camera);
};

function wrongNestAnimations(group_nest_data) {
    const group_nest = group_nest_data.nest;

    if (!animation_in_progress) {
        animation_in_progress = true;
        const goal_pos_x = group_nest.position.x - 10;

        const anim_pos = { position: group_nest.position.clone() };
        const animation = new TWEEN.Tween(anim_pos)
            .to({ position: new THREE.Vector3(goal_pos_x, 0, 0) }, 100)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(() => {
                group_nest.position.x = anim_pos.position.x;
            })
            .onComplete(() => {
                group_nest.updateMatrixWorld();
                group_nest_data.bb.setFromObject(group_nest);
                group_nest_data.bb.min.y = -30;
                group_nest_data.bb.max.y = 100;
            })
            .repeat(10)
            .yoyo(true)
            .start();
    };
};

function rightNestAnimation(group_nest_data) {
    const group_nest = group_nest_data.nest;
    const group_eggs = group_nest.getObjectByName('group_eggs');

    if (!animation_egg_in_progress) {
        animation_egg_in_progress = true;
        const goal_pos_y = 10;

        for (let i = 0; i < group_eggs.children.length; i++) {
            const random_delay = 50 * i;
            const egg = group_eggs.children[i];
            const anim_pos = { position: egg.position.clone() };
            setTimeout(() => {
                const animation = new TWEEN.Tween(anim_pos)
                    .to({ position: new THREE.Vector3(egg.position.x, goal_pos_y, egg.position.z) }, 100)
                    .easing(TWEEN.Easing.Linear.None)
                .onUpdate(() => {
                    egg.position.y = anim_pos.position.y;
                })
                .onComplete(() => {
                    egg.position.y = egg.userData.eggSize / 2;
                    })
                    .repeat(15)
                    .yoyo(true)
                    .start();
            }, random_delay);
        };
    }

};


function getRandomPosition(radius) {
    const angle = Math.random() * Math.PI * 2;
    const random_radius = randomIntFromInterval(10, radius * 0.7);
    const x = Math.cos(angle) * random_radius;
    const y = Math.sin(angle) * random_radius;
    return { x, y };
};

function createSingleNest(single_bird_data) {
    const nest_size = single_bird_data.nest.size;
    const egg_amount = single_bird_data.egg.amount;
    const egg_size = single_bird_data.egg.size;
    const egg_color = single_bird_data.egg.color;

    const group_nest = new THREE.Group();
    group_nest.name = 'group_nest';
    group_nest.userData.birdId = single_bird_data.id;

    const geo_nest = new THREE.CylinderGeometry(nest_size, nest_size - (nest_size / 4), nest_size / 4, 24, 1, true);
    const mat_nest = new THREE.MeshPhongMaterial({ color: 0xff8000, wireframe: false, side: THREE.DoubleSide });
    const mesh_nest = new THREE.Mesh(geo_nest, mat_nest);

    const geo_nest_bottom = new THREE.CylinderGeometry(nest_size - (nest_size / 4) + 0.5, nest_size - (nest_size / 4) + 0.5, 1, 24, 1, false);
    const mesh_nest_bottom = new THREE.Mesh(geo_nest_bottom, mat_nest);
    mesh_nest_bottom.position.y = - nest_size / 8;

    mesh_nest.castShadow = true;
    mesh_nest.receiveShadow = true;
    mesh_nest_bottom.castShadow = true;
    mesh_nest_bottom.receiveShadow = true;
    group_nest.add(mesh_nest, mesh_nest_bottom);

    const group_eggs = new THREE.Group();
    group_eggs.name = 'group_eggs';
    group_nest.add(group_eggs);

    for (let i = 0; i < egg_amount; i++) {
        const egg = createSingleEgg(single_bird_data.id);
        egg.scale.set(egg_size, egg_size, egg_size);
        group_eggs.add(egg);

        const { x, y } = getRandomPosition(nest_size * 0.7);
        egg.position.set(x, egg_size / 2, y);
        egg.userData.eggSize = egg_size;
    };

    const { x, y } = getRandomPosition(500);
    group_nest.position.set(x, -30, y);

    const bb = new THREE.Box3().setFromObject(group_nest);
    bb.min.y = -30;
    bb.max.y = 100;
    bb_nests.push({ nest: group_nest, bb: bb });

    return group_nest;
};

function createSingleEgg(bird_id) {
    const points = [];

    for (let deg = 0; deg <= 180; deg += 6) {
        const rad = Math.PI * deg / 180;
        const point = new THREE.Vector2((0.72 + .08 * Math.cos(rad)) * Math.sin(rad), - Math.cos(rad)); // the "egg equation"
        points.push(point);
    };

    const geometry = new THREE.LatheGeometry(points, 32);
    const material = new THREE.ShaderMaterial({
        vertexShader: eggShaders[bird_id].vertexShader,
        fragmentShader: eggShaders[bird_id].fragmentShader,
        side: THREE.DoubleSide
    });

    const mesh_egg = new THREE.Mesh(geometry, material);
    mesh_egg.castShadow = true;
    mesh_egg.receiveShadow = true;
    return mesh_egg;
};

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
};

function createSingleBird(bird_id, callback) {
    const bird_data = gameData.birds[bird_id];

    bird = new THREE.Group();
    bird.castShadow = true;
    bird.receiveShadow = true;
    bird.userData.birdId = bird_id;
    bird.name = bird_data.name;

    const bird_scale = bird_data.size;
    bird.scale.set(bird_scale, bird_scale, bird_scale);

    // Create different materials for each part
    const wingMaterial = new THREE.MeshBasicMaterial({
        name: 'wing',
        color: bird_data.materials.color_wings, // Darker brown for wings
        shininess: 5
    });

    const tailMaterial = new THREE.MeshPhongMaterial({
        name: 'tail',
        color: bird_data.materials.color_tail, // Very dark brown for tail
        shininess: 5
    });

    const beakMaterial = new THREE.MeshPhongMaterial({
        name: 'beak',
        color: bird_data.materials.color_beak,
        shininess: 5
    });

    const eyeMaterial = new THREE.MeshPhongMaterial({
        name: 'eye',
        color: 0x000000, // Black for eyes
        shininess: 5
    });

    const bodyMaterial = new THREE.MeshBasicMaterial({
        name: 'body',
        shininess: 5
    });

    textureLoader.load(bird_data.materials.mat_body, function(texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false;
        bodyMaterial.map = texture;

        const bird_nr = 10;
    loader.load(`bird${bird_nr}.glb`, function (gltf) {
        const model = gltf.scene;
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;

                console.log('Mesh name:', node);
                
                switch(node.name) {
                    case 'wing1_obj':
                    case 'wing2_obj':
                        node.material = wingMaterial;
                        break;
                    case 'tail':
                        node.material = tailMaterial;
                        break;
                    case 'body':
                        node.material = bodyMaterial;
                        break;
                    case 'beak':
                        node.material = beakMaterial;
                        break;
                    case 'eyes':
                        node.material = eyeMaterial;
                        break;
                };
                
            };
        });

        bird.add(model);

        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
    });

    callback(bird);
    });

    

    
};

function createEnvironment() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
    hemiLight.color.setHSL(0.6, 1, 0.6);
    hemiLight.groundColor.setHSL(0.095, 1, 0.75);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const hemiLightHelper = new THREE.HemisphereLightHelper(hemiLight, 10);
    //scene.add(hemiLightHelper);

    const dirLight = new THREE.DirectionalLight(0xffffff, 3);
    dirLight.color.setHSL(0.1, 1, 0.95);
    dirLight.position.set(- 1, 10.75, 1);
    dirLight.position.multiplyScalar(30);
    scene.add(dirLight);

    dirLight.castShadow = true;

    dirLight.shadow.mapSize.width = 4048;
    dirLight.shadow.mapSize.height = 4048;

    const d = 500;

    dirLight.shadow.camera.left = - d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = - d;

    dirLight.shadow.camera.far = 3500;
    dirLight.shadow.bias = - 0.0001;

    dirLight.shadow.intensity = 0.5;

    const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 10);
    //scene.add(dirLightHelper);

    const groundGeo = new THREE.PlaneGeometry(10000, 10000);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    groundMat.color.setHSL(0.095, 1, 0.75);

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = - 33;
    ground.rotation.x = - Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // SKYDOME

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
    scene.add(sky);
};

function handleKeyDown(event) {
    switch (event.code) {
        case 'ArrowLeft':
            moveDirection.left = true;
            break;
        case 'ArrowRight':
            moveDirection.right = true;
            break;
        case 'ArrowUp':
            moveDirection.forward = true;
            break;
        case 'ArrowDown':
            moveDirection.backward = true;
            break;
        case 'Space':
            moveDirection.up = true;
            break;
        case 'ShiftLeft':
            moveDirection.down = true;
            break;
        case 'KeyL':
            birdLoopAnimation();
            break;
    }
}

function handleKeyUp(event) {
    switch (event.code) {
        case 'ArrowLeft':
            moveDirection.left = false;
            break;
        case 'ArrowRight':
            moveDirection.right = false;
            break;
        case 'ArrowUp':
            moveDirection.forward = false;
            break;
        case 'ArrowDown':
            moveDirection.backward = false;
            break;
        case 'Space':
            moveDirection.up = false;
            break;
        case 'ShiftLeft':
            moveDirection.down = false;
            break;
    }
}

function birdLoopAnimation() {
    if (!animation_in_progress && bird) {
        animation_in_progress = true;

        // Store initial rotation
        const startRotation = {
            x: bird.rotation.x,
            y: bird.rotation.y,
            z: bird.rotation.z
        };

        // Create animation for a full loop
        const rotationTween = new TWEEN.Tween(startRotation)
            .to({ x: startRotation.x + Math.PI * 2 }, 1000) // 1000ms = 1 second for full rotation
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                bird.rotation.x = startRotation.x;
            })
            .onComplete(() => {
                animation_in_progress = false;
                bird.rotation.x = startRotation.x; // Reset to original rotation
            });

        rotationTween.start();
    }
}

function createFlowers() {
    // Create flower geometry (a simple cross of planes for petals)
    const petalGeometry = new THREE.PlaneGeometry(3, 3);

    // Create petals materials
    const petalMaterials = [
        new THREE.MeshPhongMaterial({ color: 0xFF69B4, side: THREE.DoubleSide }), // Pink
        new THREE.MeshPhongMaterial({ color: 0xFFFF00, side: THREE.DoubleSide }), // Yellow
        new THREE.MeshPhongMaterial({ color: 0xFF0000, side: THREE.DoubleSide }), // Red
        new THREE.MeshPhongMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide }), // White
        new THREE.MeshPhongMaterial({ color: 0x800080, side: THREE.DoubleSide }), // Purple
    ];

    // Create instanced mesh directly with the petal geometry
    const flowerCount = 2000;
    const flowers = new THREE.InstancedMesh(petalGeometry, petalMaterials[0], flowerCount);

    // Matrix for transforming each flower instance
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    // Place flowers randomly in a radius around the center
    const radius = 1000;
    for (let i = 0; i < flowerCount; i++) {
        // Random position within radius
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        position.set(
            Math.cos(angle) * r,
            -30, // Same height as ground
            Math.sin(angle) * r
        );

        // Random rotation
        rotation.set(
            0.1 * Math.random(), // Slight random tilt
            Math.random() * Math.PI * 2, // Random rotation around Y
            0
        );
        quaternion.setFromEuler(rotation);

        // Random scale variation
        const scaleY = 0.5 + Math.random() * 0.3;
        scale.set(scaleY, scaleY, scaleY);

        // Combine transformations
        matrix.compose(position, quaternion, scale);
        flowers.setMatrixAt(i, matrix);

        // Set random color for each flower
        flowers.setColorAt(i, new THREE.Color(petalMaterials[Math.floor(Math.random() * petalMaterials.length)].color));
    }

    flowers.castShadow = true;
    flowers.receiveShadow = true;

    return flowers;
}