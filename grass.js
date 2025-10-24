
import { BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, CircleGeometry, DoubleSide, Plane, Vector3, MathUtils, MeshPhongMaterial, PlaneHelper, BackSide, UniformsUtils, UniformsLib, MeshNormalMaterial, BoxGeometry } from "three";



const BLADE_WIDTH = 2;
const BLADE_HEIGHT = 5;
const BLADE_HEIGHT_VARIATION = 6;
const BLADE_VERTEX_COUNT = 5;
const BLADE_TIP_OFFSET = 1;

const clip_planes = [];
const clip_planes_userdata = [];

function interpolate(val, oldMin, oldMax, newMin, newMax) {
	return ((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin) + newMin;
};

export class GrassGeometry extends BufferGeometry {
	constructor(size, count, size_chalet, floor, texture) {
		super();

		const positions = [];
		const uvs = [];
		const indices = [];

		for (let i = 0; i < count; i++) {
			const surfaceMin = (size / 2) * -1;
			const surfaceMax = size / 2;
			const radius = (size / 2) * Math.random();
			const theta = Math.random() * 2 * Math.PI;

			let x = radius * Math.cos(theta);
			let y = radius * Math.sin(theta);

			uvs.push(
				...Array.from({ length: BLADE_VERTEX_COUNT }).flatMap(() => [
					interpolate(x, surfaceMin, surfaceMax, 0, 1),
					interpolate(y, surfaceMin, surfaceMax, 0, 1)
				])
			);

			const blade = this.computeBlade([x, 0, y], i);
			positions.push(...blade.positions);
			indices.push(...blade.indices);
		};

		this.setAttribute(
			"position",
			new BufferAttribute(new Float32Array(positions), 3)
		);
		this.setAttribute(
			"uv",
			new BufferAttribute(new Float32Array(uvs), 2)
		);
		this.setIndex(indices);
		this.computeVertexNormals();
	};

	// Grass blade generation, covered in https://smythdesign.com/blog/stylized-grass-webgl
	computeBlade(center, index = 0) {
		const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;
		const vIndex = index * BLADE_VERTEX_COUNT;

		// Randomize blade orientation and tip angle
		const yaw = Math.random() * Math.PI * 2;
		const yawVec = [Math.sin(yaw), 0, -Math.cos(yaw)];
		const bend = Math.random() * Math.PI * 2;
		const bendVec = [Math.sin(bend), 0, -Math.cos(bend)];

		// Calc bottom, middle, and tip vertices
		const bl = yawVec.map((n, i) => n * (BLADE_WIDTH / 2) * 1 + center[i]);
		const br = yawVec.map((n, i) => n * (BLADE_WIDTH / 2) * -1 + center[i]);
		const tl = yawVec.map((n, i) => n * (BLADE_WIDTH / 4) * 1 + center[i]);
		const tr = yawVec.map((n, i) => n * (BLADE_WIDTH / 4) * -1 + center[i]);
		const tc = bendVec.map((n, i) => n * BLADE_TIP_OFFSET + center[i]);

		// Attenuate height
		tl[1] += height / 2;
		tr[1] += height / 2;
		tc[1] += height;

		return {
			positions: [...bl, ...br, ...tr, ...tl, ...tc],
			indices: [
				vIndex,
				vIndex + 1,
				vIndex + 2,
				vIndex + 2,
				vIndex + 4,
				vIndex + 3,
				vIndex + 3,
				vIndex,
				vIndex + 2
			]
		};
	};
};

class Grass extends Mesh {
	constructor(size, count, size_chalet, texture) {
        /*
		createSingleClippingPlane(new Vector3(-1, 0, 0), new Vector3(-size, 0, 0));
		createSingleClippingPlane(new Vector3(0, 0, -1), new Vector3(0, 0, size_chalet.min.z));
		createSingleClippingPlane(new Vector3(1, 0, 0), new Vector3(size_chalet.max.x, 0, 0));
		createSingleClippingPlane(new Vector3(0, 0, 1), new Vector3(0, 0, size_chalet.max.z));
        */

		const geo_circle = new CircleGeometry(size / 2, 32).rotateX(Math.PI / 2);
		const floor = new Mesh( geo_circle );
		floor.position.y = 0;
		floor.rotation.y = -MathUtils.degToRad(90);
		floor.receiveShadow = true;

		const cloudTexture = texture;
		const geometry = new GrassGeometry(size * .75, count, size_chalet, floor);

		const material = new MeshPhongMaterial({
			clipping: true,
			clippingPlanes: clip_planes,
			clipIntersection: true,
			side: DoubleSide,
			transparent: true,
			color: 0x83aed5
		});

		material.onBeforeCompile = function (shader) {
			shader.uniforms.uTime = { value: 0 };
			shader.uniforms.uCloud = { value: cloudTexture };

			const arr_vertex = `
				uniform float uTime;
				varying vec3 vPosition;
				varying vec2 vUv;
				float wave(float waveSize, float tipDistance, float centerDistance) {
				bool isTip = (gl_VertexID + 1) % 5 == 0;
				float waveDistance = isTip ? tipDistance : centerDistance;
					return sin((uTime / 500.0) + waveSize) * waveDistance;
				}
			`;

			shader.vertexShader = arr_vertex + shader.vertexShader;
		
			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				`
					#include <begin_vertex>
					vPosition = position;
					vUv = uv;
					vNormal = normalize(normalMatrix * normal);
					if (vPosition.y < 0.0) {
						vPosition.y = 0.0;
					} else {
						vPosition.x += wave(uv.x * 10.0, 0.3, 0.1);
					}
					gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
				`
			);
			
			const arr_fragment = `
				uniform sampler2D uCloud;
				varying vec3 vPosition;
				varying vec2 vUv;
				uniform vec2 resolution;
				vec3 green = vec3(0.525,0.8,0.376);
			`;

			shader.fragmentShader = arr_fragment + shader.fragmentShader;
			shader.fragmentShader = shader.fragmentShader.replace(
				'vec4 diffuseColor = vec4( diffuse, opacity );',
				`
					float strength = 1.0 - distance(vUv, vec2(0.5));
					float alpha = smoothstep(0.55, 0.6, strength);
					vec3 color = mix(green * 0.7, green, vPosition.y / 10.0);
					color = mix(color, texture2D(uCloud, vUv).rgb, 0.4);
					float lighting = normalize(dot(vNormal, vec3(10)));
					vec4 diffuseColor = vec4(color + lighting * 0.03, alpha);
				`
			);
			
			material.userData.shader = shader;
		};
		
		floor.material = material;
		super(geometry, material);

		this.receiveShadow = true;
		this.material.needsUpdate = true;
		this.add(floor);
		this.name = 'grass';
	};

	update(time) {
		this.material.uniforms.uTime.value = time;
	};
};

function createSingleClippingPlane(angle, pos) {
	const plane = new Plane(angle, 0);
	plane.translate(pos);

	/*
	const helper = new PlaneHelper(plane, 10, 0xc81d0a)
	globals.scene.parent.add(helper);
	*/

	clip_planes.push(plane);
	clip_planes_userdata.push({
		last_pos: pos,
		//helper: helper
	});
};

export const updateGrassClippingPlanes = function () {
	/*
	const size_chalet = getMinMaxValuesChalet();

	const positions = [
		new Vector3(size_chalet.min.x, 0, 0),
		new Vector3(0, 0, size_chalet.min.z),
		new Vector3(size_chalet.max.x, 0, 0),
		new Vector3(0, 0, size_chalet.max.z)
	];

	for (let i = 0; i < 4; i++) {
		const diff_x = positions[i].x - clip_planes_userdata[i].last_pos.x;
		const diff_z = positions[i].z - clip_planes_userdata[i].last_pos.z;
		clip_planes[i].translate(new Vector3(diff_x, 0, diff_z));

		//clip_planes_userdata[i].helper.updateMatrixWorld();
		clip_planes_userdata[i].last_pos = positions[i];
	};
	*/
};

export default Grass;

