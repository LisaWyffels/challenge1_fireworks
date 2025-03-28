const eggVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const eggFragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    // Pseudo-random function
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    // 2D noise
    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));

        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
        // Cream base color
        vec3 eggColor = vec3(0.96, 0.93, 0.86);      // Warm cream color
        vec3 speckleColor = vec3(0.92, 0.87, 0.78);  // Slightly darker cream for speckles
        
        // Create multiple layers of noise for more natural variation
        float noiseScale = 20.0;
        vec2 noisePos = vPosition.xy * noiseScale;
        float n = noise(noisePos);
        float n2 = noise(noisePos * 2.0) * 0.5;
        float n3 = noise(noisePos * 4.0) * 0.25;
        
        // Combine noise layers
        float combinedNoise = n + n2 + n3;
        
        // Create subtle speckle effect
        float speckles = smoothstep(0.7, 0.9, combinedNoise);
        
        // Mix colors
        vec3 finalColor = mix(eggColor, speckleColor, speckles * 0.3);
        
        // Add subtle variation based on position for depth
        float positionVariation = (vPosition.y + 1.0) * 0.1;
        finalColor *= (0.95 + positionVariation);

        // Add lighting variation based on normal
        float lightIntensity = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
        finalColor *= 0.8 + lightIntensity * 0.3;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

export const eggShaders = [
    {
        vertexShader: eggVertexShader,
        fragmentShader: eggFragmentShader
    },
    {
        vertexShader: eggVertexShader,
        fragmentShader: eggFragmentShader
    },
    {
        vertexShader: eggVertexShader,
        fragmentShader: eggFragmentShader
    }

]


