'use client';
import { useEffect, useRef, useState } from 'react';

const Explosion = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const timeRef = useRef(0);
  const [isExploding, setIsExploding] = useState(false);
  const explosionTimeRef = useRef(0);

  const vertexShaderSource = `#version 300 es
    in vec4 aPosition;
    void main() {
      gl_Position = aPosition;
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    
    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform bool uIsExploding;
    uniform float uExplosionTime;
    
    #define NUM_PARTICLES 100
    #define PI 3.14159265359
    
    // Hash function for randomness
    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }
    
    // 2D hash
    vec2 hash2(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(p) * 43758.5453);
    }
    
    // Noise function
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      float a = hash(dot(i, vec2(1.0, 157.0)));
      float b = hash(dot(i + vec2(1.0, 0.0), vec2(1.0, 157.0)));
      float c = hash(dot(i + vec2(0.0, 1.0), vec2(1.0, 157.0)));
      float d = hash(dot(i + vec2(1.0, 1.0), vec2(1.0, 157.0)));
      
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    // Particle shape function
    float particle(vec2 uv, vec2 pos, float size, float brightness) {
      float dist = length(uv - pos);
      return brightness * smoothstep(size, 0.0, dist);
    }
    
    // Explosion wave function
    float explosionWave(vec2 uv, vec2 center, float radius, float thickness) {
      float dist = length(uv - center);
      return smoothstep(radius, radius - thickness * 0.5, dist) * 
             smoothstep(radius - thickness, radius - thickness * 1.5, dist);
    }
    
    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      uv = uv * 2.0 - 1.0;
      uv.x *= uResolution.x / uResolution.y;
      
      vec2 mousePos = uMouse * 2.0 - 1.0;
      mousePos.x *= uResolution.x / uResolution.y;
      
      // Center of explosion
      vec2 center = uIsExploding ? mousePos : vec2(0.0);
      
      // Base color
      vec3 color = vec3(0.0);
      
      // Explosion time management
      float explosionProgress = uIsExploding ? uExplosionTime : uTime * 0.2;
      float waveTime = explosionProgress * 2.0;
      
      // Add explosion waves
      for (int i = 0; i < 5; i++) {
        float offset = float(i) * 0.2;
        float waveRadius = (waveTime - offset) * 1.5;
        if (waveRadius > 0.0 && waveRadius < 3.0) {
          float thickness = 0.05 + 0.1 * exp(-waveRadius * 0.8);
          float wave = explosionWave(uv, center, waveRadius, thickness);
          
          // Wave color based on radius
          vec3 waveColor = mix(
            vec3(1.0, 0.5, 0.1),  // Orange/yellow at center
            vec3(0.1, 0.2, 0.8),  // Blue at edges
            waveRadius / 3.0
          );
          
          color += wave * waveColor * (1.0 - waveRadius / 3.0);
        }
      }
      
      // Add particles
      for (int i = 0; i < NUM_PARTICLES; i++) {
        // Create semi-deterministic random values for this particle
        float idx = float(i);
        vec2 randomDir = hash2(vec2(idx, idx * 0.5));
        float randomAngle = randomDir.x * 2.0 * PI;
        float randomSpeed = mix(0.5, 1.5, randomDir.y);
        float randomSize = mix(0.01, 0.04, hash(idx * 3.1415));
        float randomOffset = hash(idx * 2.7182) * 0.5;
        
        // Calculate particle position based on time
        float particleTime = explosionProgress - randomOffset;
        
        // Different particle behaviors
        vec2 particlePos;
        float brightness = 0.0;
        float lifespan = 3.0;
        
        if (particleTime > 0.0 && particleTime < lifespan) {
          float normalizedTime = particleTime / lifespan;
          
          // Particle type based on index
          int particleType = i % 3;
          
          if (particleType == 0) {
            // Straight line particles
            particlePos = center + vec2(cos(randomAngle), sin(randomAngle)) * 
                          randomSpeed * particleTime * (1.0 + sin(particleTime * 3.0) * 0.2);
            brightness = 1.0 - normalizedTime;
          } 
          else if (particleType == 1) {
            // Spiral particles
            float spiral = randomDir.y * 2.0 * particleTime;
            particlePos = center + vec2(
              cos(randomAngle + spiral), 
              sin(randomAngle + spiral)
            ) * randomSpeed * particleTime * 0.8;
            brightness = 1.0 - normalizedTime * normalizedTime;
          }
          else {
            // Chaotic particles with noise influence
            vec2 noiseInput = vec2(randomAngle * 0.1, particleTime * 0.5);
            vec2 noiseOffset = vec2(
              cos(randomAngle) * (noise(noiseInput) - 0.5) * 2.0,
              sin(randomAngle) * (noise(noiseInput + vec2(100.0)) - 0.5) * 2.0
            );
            
            particlePos = center + 
                         (vec2(cos(randomAngle), sin(randomAngle)) + noiseOffset * 0.5) * 
                         randomSpeed * particleTime;
            
            brightness = 1.0 - pow(normalizedTime, 1.5);
          }
          
          // Add this particle to the scene
          float p = particle(uv, particlePos, randomSize * (1.0 + normalizedTime), brightness);
          
          // Particle color based on angle and time
          vec3 particleColor = mix(
            mix(vec3(1.0, 0.3, 0.1), vec3(1.0, 0.8, 0.1), randomDir.x),
            mix(vec3(0.1, 0.5, 1.0), vec3(0.6, 0.2, 0.9), randomDir.y),
            normalizedTime
          );
          
          color += p * particleColor * 1.5;
        }
      }
      
      // Add glow
      float glow = length(color) * 0.3;
      color += glow * vec3(0.5, 0.2, 1.0);
      
      // Output final color with gamma correction
      fragColor = vec4(pow(color, vec3(0.8)), 1.0);
    }
  `;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }
    glRef.current = gl;

    // Create shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader!, vertexShaderSource);
    gl.compileShader(vertexShader!);

    if (!gl.getShaderParameter(vertexShader!, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader!));
      return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader!, fragmentShaderSource);
    gl.compileShader(fragmentShader!);

    if (!gl.getShaderParameter(fragmentShader!, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader!));
      return;
    }

    // Create program
    const program = gl.createProgram();
    gl.attachShader(program!, vertexShader!);
    gl.attachShader(program!, fragmentShader!);
    gl.linkProgram(program!);

    if (!gl.getProgramParameter(program!, gl.LINK_STATUS)) {
      console.error('Program linking failed:', gl.getProgramInfoLog(program!));
      return;
    }

    programRef.current = program;

    // Create a buffer for the vertices
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Define the vertices of a rectangle covering the entire canvas
    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Get the position attribute location
    const positionAttributeLocation = gl.getAttribLocation(program!, 'aPosition');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Get the uniform locations
    const resolutionUniformLocation = gl.getUniformLocation(program!, 'uResolution');
    const timeUniformLocation = gl.getUniformLocation(program!, 'uTime');
    const mouseUniformLocation = gl.getUniformLocation(program!, 'uMouse');
    const isExplodingUniformLocation = gl.getUniformLocation(program!, 'uIsExploding');
    const explosionTimeUniformLocation = gl.getUniformLocation(program!, 'uExplosionTime');

    // Handle mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: 1.0 - (e.clientY - rect.top) / rect.height, // Flip Y to match WebGL coordinate system
      };
    };

    // Handle mouse click to trigger explosion
    const handleMouseClick = () => {
      setIsExploding(true);
      explosionTimeRef.current = 0;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleMouseClick);

    // Animation function
    const render = () => {
      if (!canvas || !gl || !programRef.current) return;

      // Update canvas size if needed
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      // Update time
      timeRef.current += 0.01;
      if (isExploding) {
        explosionTimeRef.current += 0.01;
        
        // Reset explosion after some time
        if (explosionTimeRef.current > 5.0) {
          setIsExploding(false);
        }
      }

      // Clear the canvas
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Use the program
      gl.useProgram(programRef.current);

      // Set the uniforms
      gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
      gl.uniform1f(timeUniformLocation, timeRef.current);
      gl.uniform2f(mouseUniformLocation, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1i(isExplodingUniformLocation, isExploding ? 1 : 0);
      gl.uniform1f(explosionTimeUniformLocation, explosionTimeRef.current);

      // Draw the rectangle
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Request the next frame
      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Start the animation
    render();

    // Cleanup function
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleMouseClick);
      gl.deleteProgram(programRef.current);
    };
  }, [isExploding]);

  return (
    <div className="w-full h-screen relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-black"
      />
      <div className="absolute bottom-4 left-4 text-white bg-black/50 p-2 rounded">
        Click anywhere to trigger explosion
      </div>
    </div>
  );
};

export default Explosion;