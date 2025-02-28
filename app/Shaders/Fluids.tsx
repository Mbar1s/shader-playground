'use client';
import React, { useEffect, useRef, useState } from 'react';

const Fluids: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number; pressed: boolean }>({ x: 0, y: 0, pressed: false });
  
  // Fluid simulation parameters
  const [viscosity, setViscosity] = useState<number>(0.5);
  const [diffusion, setDiffusion] = useState<number>(0.8);
  const [speed, setSpeed] = useState<number>(1.0);
  const [colorIntensity, setColorIntensity] = useState<number>(1.0);
  const [showControls, setShowControls] = useState<boolean>(true);

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
    uniform float uMousePressed;
    uniform float uViscosity;
    uniform float uDiffusion;
    uniform float uSpeed;
    uniform float uColorIntensity;
    
    // Simplex noise function
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
        dot(x12.zw, x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // Fluid dynamics simulation
    vec2 fluidVelocity(vec2 uv, float time) {
      // Base flow
      vec2 velocity = vec2(0.0);
      
      // Add some noise-based flow
      float noiseScale = 3.0;
      float timeScale = time * uSpeed * 0.2;
      
      // Multiple octaves of noise for more interesting flow
      velocity.x += snoise(uv * noiseScale + vec2(timeScale, 0.0)) * 0.03;
      velocity.y += snoise(uv * noiseScale + vec2(0.0, timeScale)) * 0.03;
      
      velocity.x += snoise(uv * noiseScale * 2.0 + vec2(timeScale * 1.5, 0.0)) * 0.015;
      velocity.y += snoise(uv * noiseScale * 2.0 + vec2(0.0, timeScale * 1.5)) * 0.015;
      
      // Mouse interaction
      vec2 mousePos = uMouse / uResolution;
      vec2 mouseVec = uv - mousePos;
      float mouseDist = length(mouseVec);
      float mouseForce = exp(-mouseDist * 10.0) * uMousePressed;
      
      // Add force in the direction of mouse movement
      velocity += normalize(mouseVec) * mouseForce * 0.1;
      
      // Apply viscosity
      velocity *= mix(0.95, 0.99, uViscosity);
      
      return velocity;
    }
    
    // Advection - move values along the velocity field
    vec3 advect(vec2 uv, vec2 velocity, float dissipation) {
      vec2 pos = uv - velocity * (1.0 - uViscosity) * 0.01;
      
      // Sample colors at the new position
      float n1 = snoise(pos * 4.0 + vec2(uTime * 0.1, 0.0));
      float n2 = snoise(pos * 4.0 + vec2(0.0, uTime * 0.1));
      float n3 = snoise(pos * 4.0 + vec2(uTime * 0.15, uTime * 0.15));
      
      // Create color from noise
      vec3 color = vec3(
        0.5 + 0.5 * sin(n1 * 3.0 + uTime * 0.2),
        0.5 + 0.5 * sin(n2 * 3.0 + uTime * 0.3 + 2.0),
        0.5 + 0.5 * sin(n3 * 3.0 + uTime * 0.1 + 4.0)
      );
      
      // Apply diffusion
      color *= mix(0.95, 0.995, uDiffusion);
      
      return color;
    }
    
    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      
      // Calculate fluid velocity at this point
      vec2 velocity = fluidVelocity(uv, uTime);
      
      // Advect color values along the velocity field
      vec3 color = advect(uv, velocity, uDiffusion);
      
      // Enhance color based on velocity magnitude
      float speed = length(velocity) * 20.0;
      vec3 speedColor = vec3(speed * 2.0, speed, speed * 1.5);
      
      // Final color
      vec3 finalColor = mix(color, speedColor, 0.3) * uColorIntensity;
      
      // Add some vignette effect
      float vignette = 1.0 - smoothstep(0.5, 1.5, length((uv - 0.5) * 2.0));
      finalColor *= vignette * 1.2;
      
      // Output
      fragColor = vec4(finalColor, 1.0);
    }
  `;

  const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      throw new Error('Shader compilation failed');
    }
    
    return shader;
  };

  const initGL = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }
    glRef.current = gl;

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    // Create program
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      throw new Error('Program linking failed');
    }

    programRef.current = program;

    // Set up geometry
    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!canvas || !gl) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(canvas.clientWidth * dpr);
    const displayHeight = Math.floor(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, displayWidth, displayHeight);
    }
  };

  const render = () => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    gl.useProgram(program);

    // Update uniforms
    const uResolution = gl.getUniformLocation(program, 'uResolution');
    gl.uniform2f(uResolution, gl.canvas.width, gl.canvas.height);

    const uTime = gl.getUniformLocation(program, 'uTime');
    timeRef.current += 0.016 * speed;
    gl.uniform1f(uTime, timeRef.current);

    const uMouse = gl.getUniformLocation(program, 'uMouse');
    gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
    
    const uMousePressed = gl.getUniformLocation(program, 'uMousePressed');
    gl.uniform1f(uMousePressed, mouseRef.current.pressed ? 1.0 : 0.0);
    
    const uViscosity = gl.getUniformLocation(program, 'uViscosity');
    gl.uniform1f(uViscosity, viscosity);
    
    const uDiffusion = gl.getUniformLocation(program, 'uDiffusion');
    gl.uniform1f(uDiffusion, diffusion);
    
    const uSpeed = gl.getUniformLocation(program, 'uSpeed');
    gl.uniform1f(uSpeed, speed);
    
    const uColorIntensity = gl.getUniformLocation(program, 'uColorIntensity');
    gl.uniform1f(uColorIntensity, colorIntensity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    animationFrameRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    try {
      initGL();
      resizeCanvas();
      render();

      const handleResize = () => {
        resizeCanvas();
      };

      const handleMouseMove = (event: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
          x: event.clientX - rect.left,
          y: canvas.height - (event.clientY - rect.top),
          pressed: mouseRef.current.pressed
        };
      };
      
      const handleMouseDown = () => {
        mouseRef.current = { ...mouseRef.current, pressed: true };
      };
      
      const handleMouseUp = () => {
        mouseRef.current = { ...mouseRef.current, pressed: false };
      };
      
      const handleTouchStart = (event: TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas || !event.touches[0]) return;
        
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
          x: event.touches[0].clientX - rect.left,
          y: canvas.height - (event.touches[0].clientY - rect.top),
          pressed: true
        };
        
        // Prevent scrolling while interacting with the canvas
        event.preventDefault();
      };
      
      const handleTouchMove = (event: TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas || !event.touches[0]) return;
        
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
          x: event.touches[0].clientX - rect.left,
          y: canvas.height - (event.touches[0].clientY - rect.top),
          pressed: true
        };
        
        // Prevent scrolling while interacting with the canvas
        event.preventDefault();
      };
      
      const handleTouchEnd = () => {
        mouseRef.current = { ...mouseRef.current, pressed: false };
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchstart', handleTouchStart, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        cancelAnimationFrame(animationFrameRef.current);
      };
    } catch (error) {
      console.error('Error initializing WebGL:', error);
    }
  }, [speed]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      
      {/* Controls Panel */}
      <div className="absolute bottom-4 right-4">
        <button 
          onClick={() => setShowControls(!showControls)}
          className="bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-md mb-2 hover:bg-black/80"
        >
          {showControls ? 'Hide Controls' : 'Show Controls'}
        </button>
        
        {showControls && (
          <div className="bg-black/70 backdrop-blur-md p-4 rounded-md text-white w-64">
            <h3 className="text-lg font-semibold mb-3">Fluid Controls</h3>
            
            <div className="mb-3">
              <label className="block mb-1 text-sm">Viscosity: {viscosity.toFixed(2)}</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={viscosity}
                onChange={(e) => setViscosity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="mb-3">
              <label className="block mb-1 text-sm">Diffusion: {diffusion.toFixed(2)}</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={diffusion}
                onChange={(e) => setDiffusion(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="mb-3">
              <label className="block mb-1 text-sm">Speed: {speed.toFixed(2)}</label>
              <input 
                type="range" 
                min="0.1" 
                max="3" 
                step="0.1" 
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="mb-3">
              <label className="block mb-1 text-sm">Color Intensity: {colorIntensity.toFixed(2)}</label>
              <input 
                type="range" 
                min="0.1" 
                max="2" 
                step="0.1" 
                value={colorIntensity}
                onChange={(e) => setColorIntensity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="text-xs mt-2">
              Click and drag to interact with the fluid
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Fluids;