const robinVertexShader = `
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

const robinFragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        // Base colors for robin
        vec3 breastColor = vec3(0.95, 0.2, 0.1);    // Bright red breast
        vec3 bodyColor = vec3(0.35, 0.25, 0.2);     // Brown body
        vec3 greyColor = vec3(0.75, 0.75, 0.75);    // Light grey color

        // Create masks for different body parts
        // Red breast mask - front center area (reversed z check)
        float breastMask = smoothstep(0.2, -0.2, vPosition.z) *  // Changed this line to reverse front/back
                          (1.0 - abs(smoothstep(-0.2, 0.2, vPosition.y))); // Center height
        
        // Grey bottom mask
        float greyMask = smoothstep(-0.2, 0.0, vPosition.y);  // Bottom half
        
        // Brown top mask (default)
        float brownMask = smoothstep(-0.1, 0.2, vPosition.y);  // Top part

        // Start with grey color for bottom
        vec3 finalColor = greyColor;
        
        // Layer the colors
        finalColor = mix(finalColor, bodyColor, brownMask);  // Add brown top
        
        // Add red breast last to overlay
        if (breastMask > 0.3) {
            finalColor = mix(finalColor, breastColor, breastMask);
        }

        // Add lighting variation based on normal
        float lightIntensity = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
        finalColor *= 0.8 + lightIntensity * 0.4;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const pigeonFragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    // Pseudo-random function
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    // 2D noise for feather texture
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
        // Pigeon colors
        vec3 greyColor = vec3(0.65, 0.67, 0.7);      // Blue-grey base
        vec3 darkGreyColor = vec3(0.3, 0.32, 0.35);  // Darker grey for wings
        vec3 whiteColor = vec3(0.9, 0.9, 0.9);       // White patch

        // Create noise for feather texture
        float noiseScale = 15.0;
        vec2 noisePos = vPosition.xy * noiseScale;
        float featherNoise = noise(noisePos);
        
        // Create wing pattern
        float wingMask = smoothstep(0.2, 0.4, abs(vPosition.x));
        
        // Create small white patch on top
        float whitePatch = smoothstep(0.1, 0.2, vPosition.y) *     // Height control
                          smoothstep(0.3, 0.2, vPosition.y) *      // Cut off top
                          smoothstep(0.1, -0.1, vPosition.z) *     // Front-back position
                          smoothstep(0.1, -0.1, abs(vPosition.x)) * // Center horizontally
                          0.9;                                      // Intensity
        
        // Start with base grey color
        vec3 finalColor = greyColor;
        
        // Add darker wings
        finalColor = mix(finalColor, darkGreyColor, wingMask * 0.8);
        
        // Add small white patch
        finalColor = mix(finalColor, whiteColor, whitePatch);
        
        // Add feather texture variation
        finalColor *= (0.95 + featherNoise * 0.1);

        // Add lighting variation
        float lightIntensity = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
        finalColor *= 0.85 + lightIntensity * 0.3;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const blueTitFragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        // Blue Tit body colors
        vec3 blueColor = vec3(0.2, 0.4, 0.8);      // Blue for wings/back
        vec3 yellowColor = vec3(0.95, 0.85, 0.2);   // Yellow underparts
        vec3 whiteColor = vec3(0.9, 0.9, 0.9);      // White base

        // Create masks for different body parts
        // Blue back and wings
        float wingMask = smoothstep(0.2, 0.4, abs(vPosition.x)) +  // Wings
                        smoothstep(0.1, 0.2, vPosition.y);         // Back
        
        // Yellow underparts
        float breastMask = smoothstep(-0.3, 0.3, vPosition.z) * 
                          smoothstep(0.2, -0.2, vPosition.y) *
                          (1.0 - wingMask * 0.8);  // Reduce yellow on wings
        
        // Start with white base
        vec3 finalColor = whiteColor;
        
        // Layer the colors
        finalColor = mix(finalColor, blueColor, wingMask);     // Add blue wings/back
        finalColor = mix(finalColor, yellowColor, breastMask); // Add yellow breast

        // Add lighting variation
        float lightIntensity = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
        finalColor *= 0.8 + lightIntensity * 0.3;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

export const birdShaders = [
    {
        vertexShader: robinVertexShader,
        fragmentShader: blueTitFragmentShader
    },
    {
        vertexShader: robinVertexShader,
        fragmentShader: pigeonFragmentShader
    },
    {
        vertexShader: robinVertexShader,
        fragmentShader: robinFragmentShader
    },
];