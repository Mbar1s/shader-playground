'use client';
import { useEffect, useRef, useState } from 'react';

const Lavalamp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const timeRef = useRef(0);

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
    
    #define NUM_METABALLS 5
    #define MIN_RADIUS 0.15
    #define MAX_RADIUS 0.25
    
    // Noise function for organic movement
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    // Metaball field function
    float metaball(vec2 p, vec2 center, float radius) {
      float d = length(p - center);
      return radius / d;
    }
    
    // Fresnel effect
    float fresnel(float cosTheta, float F0, float power) {
      return F0 + (1.0 - F0) * pow(1.0 - cosTheta, power);
    }
    
    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      uv = uv * 2.0 - 1.0;
      uv.x *= uResolution.x / uResolution.y;
      
      float metaballField = 0.0;
      vec2 mouseInfluence = (uMouse * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
      float mouseHeat = length(mouseInfluence - uv) < 0.3 ? 2.0 : 1.0;
      
      // Calculate metaball positions with organic movement
      for(int i = 0; i < NUM_METABALLS; i++) {
        float angle = float(i) * 6.28 / float(NUM_METABALLS) + uTime * (0.2 + 0.1 * float(i));
        float radius = mix(MIN_RADIUS, MAX_RADIUS, 
          0.5 + 0.5 * sin(uTime * 0.5 + float(i)));
        
        vec2 offset = vec2(
          cos(angle + noise(vec2(uTime * 0.1, float(i)))),
          sin(angle + noise(vec2(uTime * 0.1 + 100.0, float(i))))
        );
        
        vec2 center = 0.5 * offset * mouseHeat;
        metaballField += metaball(uv, center, radius);
      }
      
      // Color and lighting
      vec3 baseColor = vec3(0.8, 0.2, 0.1);
      vec3 glowColor = vec3(1.0, 0.5, 0.2);
      float threshold = 1.0;
      
      // Smooth stepping for organic blob edges
      float blob = smoothstep(threshold - 0.2, threshold + 0.2, metaballField);
      
      // Fresnel effect
      float fresnelTerm = fresnel(blob, 0.04, 5.0);
      
      // Glow effect
      float glow = exp(-metaballField * 0.2) * 0.5;
      
      // Combine effects
      vec3 finalColor = mix(baseColor, glowColor, fresnelTerm);
      finalColor += glowColor * glow * 0.5;
      
      // Add refraction-like effect using the metaball field gradient
      vec2 refraction = normalize(vec2(dFdx(metaballField), dFdy(metaballField))) * 0.05;
      vec3 refractionColor = mix(baseColor * 1.2, glowColor * 1.2, 
                                noise(uv + refraction + vec2(uTime * 0.1)));
      finalColor = mix(finalColor, refractionColor, 0.2);
      
      fragColor = vec4(finalColor * blob, blob);
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
    timeRef.current += 0.016;
    gl.uniform1f(uTime, timeRef.current);

    const uMouse = gl.getUniformLocation(program, 'uMouse');
    gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);

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
          x: (event.clientX - rect.left) / rect.width,
          y: 1.0 - (event.clientY - rect.top) / rect.height,
        };
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('mousemove', handleMouseMove);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        cancelAnimationFrame(animationFrameRef.current);
      };
    } catch (error) {
      console.error('Error initializing WebGL:', error);
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'block',
      }}
    />
  );
};

export default Lavalamp;