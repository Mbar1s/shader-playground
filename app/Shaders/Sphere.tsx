"use client"
import React from 'react'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

const vertexShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMouseVelocity;
  uniform sampler2D uPositionTexture;
  
  attribute float size;
  attribute vec3 velocity;
  attribute vec2 reference;
  
  varying vec3 vPosition;
  varying vec3 vVelocity;
  
  // Noise functions for natural movement
  float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }
  
  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 permute(vec4 x) {
    return mod289(((x*34.0)+1.0)*x);
  }

  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

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

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vPosition = position;
    vVelocity = velocity;
    
    // Base position with time-based movement
    vec3 pos = position;
    
    // Add noise-based movement
    float noiseScale = 2.0;
    float timeScale = 0.5;
    vec3 noisePos = pos * noiseScale + vec3(uTime * timeScale);
    vec3 noiseForce = vec3(
      snoise(noisePos),
      snoise(noisePos + 100.0),
      snoise(noisePos + 300.0)
    ) * 0.005;
    
    // Particle interaction forces
    vec3 force = vec3(0.0);
    float interactionRadius = 0.2;
    float repulsionStrength = 0.002;
    float attractionStrength = 0.001;
    
    // Calculate forces from nearby particles
    for(float x = 0.0; x < 1.0; x += 0.1) {
      for(float y = 0.0; y < 1.0; y += 0.1) {
        vec4 neighborPos = texture2D(uPositionTexture, vec2(x, y));
        vec3 diff = neighborPos.xyz - pos;
        float dist = length(diff);
        
        if(dist > 0.0 && dist < interactionRadius) {
          vec3 dir = normalize(diff);
          // Repulsion at very close distances
          if(dist < interactionRadius * 0.5) {
            force -= dir * repulsionStrength * (1.0 - dist / (interactionRadius * 0.5));
          }
          // Attraction at medium distances
          else {
            force += dir * attractionStrength * (1.0 - dist / interactionRadius);
          }
        }
      }
    }
    
    // Apply forces
    pos += noiseForce + force;
    
    // Mouse interaction
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vec2 mousePos = uMouse * 2.0 - 1.0;
    float distToMouse = length(worldPosition.xy - mousePos);
    
    if (distToMouse < 0.5) {
      vec2 repulsionDir = normalize(worldPosition.xy - mousePos);
      pos.xy += repulsionDir * (0.5 - distToMouse) * uMouseVelocity;
    }
    
    // Keep particles within sphere bounds
    float dist = length(pos);
    if (dist > 1.0) {
      pos = normalize(pos);
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * (150.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  uniform float uTime;
  
  varying vec3 vPosition;
  varying vec3 vVelocity;
  
  void main() {
    vec2 xy = gl_PointCoord.xy - vec2(0.5);
    float r = length(xy);
    if (r > 0.5) discard;
    
    vec3 color = normalize(vPosition) * 0.5 + 0.5;
    color += normalize(vVelocity) * 0.2;
    
    float glow = 1.0 - r * 2.0;
    glow = pow(glow, 2.0);
    
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
    
    gl_FragColor = vec4(color, (glow * 0.8 + 0.2) * pulse);
  }
`

export default function ParticleSphere() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mousePosition = useRef<THREE.Vector2>(new THREE.Vector2())
  const lastMousePosition = useRef<THREE.Vector2>(new THREE.Vector2())
  const mouseVelocity = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current) return

    // Setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    
    renderer.setSize(window.innerWidth, window.innerHeight)
    containerRef.current.appendChild(renderer.domElement)
    
    camera.position.z = 2

    // Create position texture for particle interaction
    const positionSize = 32
    const positionTexture = new THREE.DataTexture(
      new Float32Array(positionSize * positionSize * 4),
      positionSize,
      positionSize,
      THREE.RGBAFormat,
      THREE.FloatType
    )
    positionTexture.needsUpdate = true

    // Create particles
    const particleCount = 2000
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    const references = new Float32Array(particleCount * 2)

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = Math.cbrt(Math.random())
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02
      
      sizes[i] = Math.random() * 0.5 + 0.2
      
      // Reference coordinates for position texture
      references[i * 2] = (i % positionSize) / positionSize
      references[i * 2 + 1] = Math.floor(i / positionSize) / positionSize
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('reference', new THREE.BufferAttribute(references, 2))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2() },
        uMouseVelocity: { value: 0 },
        uPositionTexture: { value: positionTexture }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    const particles = new THREE.Points(geometry, material)
    scene.add(particles)

    // Mouse event handlers
    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current.x = event.clientX / window.innerWidth
      mousePosition.current.y = 1 - (event.clientY / window.innerHeight)
      
      const dx = mousePosition.current.x - lastMousePosition.current.x
      const dy = mousePosition.current.y - lastMousePosition.current.y
      mouseVelocity.current = Math.sqrt(dx * dx + dy * dy)
      
      lastMousePosition.current.copy(mousePosition.current)
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Animation loop
    const clock = new THREE.Clock()
    
    function animate() {
      requestAnimationFrame(animate)
      
      const time = clock.getElapsedTime()
      
      // Update position texture
      const positions = geometry.attributes.position.array
      const textureData = new Float32Array(positionSize * positionSize * 4)
      for (let i = 0; i < particleCount; i++) {
        const index = i * 4
        textureData[index] = positions[i * 3]
        textureData[index + 1] = positions[i * 3 + 1]
        textureData[index + 2] = positions[i * 3 + 2]
        textureData[index + 3] = 1.0
      }
      positionTexture.image.data = textureData
      positionTexture.needsUpdate = true
      
      // Update uniforms
      material.uniforms.uTime.value = time
      material.uniforms.uMouse.value = mousePosition.current
      material.uniforms.uMouseVelocity.value = mouseVelocity.current * 2
      
      // Decay mouse velocity
      mouseVelocity.current *= 0.95
      
      renderer.render(scene, camera)
    }
    
    animate()

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      containerRef.current?.removeChild(renderer.domElement)
      geometry.dispose()
      material.dispose()
      positionTexture.dispose()
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
}