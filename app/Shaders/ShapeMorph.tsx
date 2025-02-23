"use client"
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

const vertexShader = `
varying vec3 vNormal;
varying vec2 vUv;
varying float vDisplacement;

uniform float uTime;
uniform float uMorphFactor;
uniform float uNoiseIntensity;
uniform float uPulseFrequency;

//	Simplex 3D Noise 
//	by Ian McEwan, Ashima Arts
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  // Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
    vUv = uv;
    vNormal = normal;
    
    // Enhanced displacement with pulsing effect
    float pulseEffect = sin(uTime * uPulseFrequency) * 0.5 + 0.5;
    float noise1 = snoise(position * 2.0 + vec3(0.0, 0.0, uTime * 0.5));
    float noise2 = snoise(position * 4.0 + vec3(0.0, uTime * 0.3, 0.0));
    float noise3 = snoise(position * 8.0 + vec3(uTime * 0.4, 0.0, 0.0));
    
    float displacement = (noise1 * 0.3 + noise2 * 0.2 + noise3 * 0.1) * uNoiseIntensity;
    displacement *= (1.0 + pulseEffect * 0.3);
    vDisplacement = displacement;
    
    // Apply displacement along normal
    vec3 newPosition = position + normal * displacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const fragmentShader = `
varying vec3 vNormal;
varying vec2 vUv;
varying float vDisplacement;
uniform float uTime;

void main() {
    // Create color based on displacement and time
    vec3 color1 = vec3(0.1, 0.4, 0.8); // Blue
    vec3 color2 = vec3(0.8, 0.2, 0.5); // Pink
    vec3 color3 = vec3(0.2, 0.8, 0.5); // Turquoise
    
    float colorMix1 = sin(uTime * 0.5) * 0.5 + 0.5;
    float colorMix2 = cos(uTime * 0.3) * 0.5 + 0.5;
    
    vec3 baseColor = mix(
        mix(color1, color2, colorMix1),
        color3,
        colorMix2
    );
    
    // Add highlights based on displacement
    float highlight = smoothstep(0.0, 0.5, vDisplacement);
    vec3 finalColor = mix(baseColor, vec3(1.0), highlight * 0.6);
    
    // Add fresnel effect
    float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    finalColor += vec3(0.3) * fresnel;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const ShapeMorph = () => {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const frameId = useRef(null);
    const meshRef = useRef(null);
    const composerRef = useRef(null);

    // Add state for current shape and controls
    const [currentShape, setCurrentShape] = React.useState('sphere');
    const [noiseIntensity, setNoiseIntensity] = React.useState(1.0);
    const [pulseFrequency, setPulseFrequency] = React.useState(1.0);

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.1);
        sceneRef.current = scene;
        
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.z = 2.5;

        const renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance",
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        mountRef.current.appendChild(renderer.domElement);

        // Lighting setup
        const ambientLight = new THREE.AmbientLight(0x333333);
        scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 2);
        mainLight.position.set(5, 5, 7);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        scene.add(mainLight);

        // Rim light
        const rimLight = new THREE.SpotLight(0x00ffff, 3);
        rimLight.position.set(-5, 0, -5);
        scene.add(rimLight);

        // Fill light
        const fillLight = new THREE.PointLight(0xff00ff, 1);
        fillLight.position.set(-5, 0, 5);
        scene.add(fillLight);

        // Post-processing
        const composer = new EffectComposer(renderer);
        composerRef.current = composer;

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.5,  // strength
            0.4,  // radius
            0.85  // threshold
        );
        composer.addPass(bloomPass);

        // Create geometries with enhanced detail
        const geometries = {
            sphere: new THREE.SphereGeometry(1, 128, 128),
            box: new THREE.BoxGeometry(1.5, 1.5, 1.5, 64, 64, 64),
            torus: new THREE.TorusGeometry(1, 0.4, 64, 128),
            octahedron: new THREE.OctahedronGeometry(1, 4)
        };

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uNoiseIntensity: { value: noiseIntensity },
                uPulseFrequency: { value: pulseFrequency }
            },
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometries[currentShape], material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshRef.current = mesh;
        scene.add(mesh);

        // Background particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 2000;
        const posArray = new Float32Array(particlesCount * 3);
        
        for(let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 10;
        }
        
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.005,
            color: 0xffffff,
            transparent: true,
            opacity: 0.5
        });
        
        const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);

        // Enhanced animation loop
        const animate = (time) => {
            const t = time * 0.001;
            material.uniforms.uTime.value = t;
            material.uniforms.uNoiseIntensity.value = noiseIntensity;
            material.uniforms.uPulseFrequency.value = pulseFrequency;
            
            mesh.rotation.x += 0.001;
            mesh.rotation.y += 0.002;
            mesh.rotation.z += 0.0005;

            // Animate lights
            rimLight.position.x = Math.sin(t) * 5;
            rimLight.position.z = Math.cos(t) * 5;
            
            fillLight.position.x = Math.cos(t * 0.5) * 5;
            fillLight.position.z = Math.sin(t * 0.5) * 5;

            // Animate particles
            particlesMesh.rotation.y = t * 0.05;
            
            composer.render();
            frameId.current = requestAnimationFrame(animate);
        };
        
        animate(0);

        // Enhanced resize handler
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            
            renderer.setSize(width, height);
            composer.setSize(width, height);
        };
        
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            if (frameId.current) {
                cancelAnimationFrame(frameId.current);
            }
            if (mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
            window.removeEventListener('resize', handleResize);
            
            // Dispose of geometries and materials
            Object.values(geometries).forEach(geometry => geometry.dispose());
            material.dispose();
            particlesGeometry.dispose();
            particlesMaterial.dispose();
        };
    }, [currentShape, noiseIntensity, pulseFrequency]);

    return (
        <div className="relative w-full min-h-screen bg-black">
            <div ref={mountRef} className="w-full h-full" />
            
            {/* Controls UI */}
            <div className="absolute top-4 left-4 space-y-4 bg-black/50 p-4 rounded-lg">
                <select 
                    value={currentShape}
                    onChange={(e) => setCurrentShape(e.target.value)}
                    className="bg-slate-500 p-2 rounded"
                >
                    <option value="sphere">Sphere</option>
                    <option value="box">Box</option>
                    <option value="torus">Torus</option>
                    <option value="octahedron">Octahedron</option>
                </select>
                
                <div className="space-y-2">
                    <label className="text-white text-sm">Noise Intensity</label>
                    <input 
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={noiseIntensity}
                        onChange={(e) => setNoiseIntensity(parseFloat(e.target.value))}
                        className="w-full"
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-white text-sm">Pulse Frequency</label>
                    <input 
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.1"
                        value={pulseFrequency}
                        onChange={(e) => setPulseFrequency(parseFloat(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );
};

export default ShapeMorph;