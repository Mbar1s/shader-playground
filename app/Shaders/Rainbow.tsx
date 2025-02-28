"use client"
import React, { useEffect, useRef } from 'react';

const Rainbow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  let animationFrameId: number;

  const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl?.viewport(0, 0, canvas.width, canvas.height);
        if (program && resolutionLocation) {
          gl?.uniform2f(resolutionLocation, canvas.width, canvas.height);
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current = {
        x: event.clientX,
        y: event.clientY
      };
    };

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Vertex shader source
    const vertexShaderSource = `
      attribute vec4 a_position;
      void main() {
        gl_Position = a_position;
      }
    `;

    // Fragment shader source (defined in the component's return statement)
    const fragmentShaderSource = document.getElementById('fragment-shader')?.textContent;
    if (!fragmentShaderSource) {
      console.error('Fragment shader not found');
      return;
    }

    // Create and compile shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    // Create and link program
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    // Set up buffers
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Set up attributes and uniforms
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

    // Animation loop
    const render = () => {
      timeRef.current += 0.01;
      gl.uniform1f(timeLocation, timeRef.current);
      gl.uniform2f(mouseLocation, mouseRef.current.x, canvas.height - mouseRef.current.y);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
      <script id="fragment-shader" type="x-shader/x-fragment">
        {`
          precision highp float;
          uniform float u_time;
          uniform vec2 u_resolution;
          uniform vec2 u_mouse;

          // Function to generate a pseudo-random value
          float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
          }

          // 2D noise function
          float noise(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            
            // Four corners in 2D of a tile
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            
            // Smooth interpolation
            vec2 u = f * f * (3.0 - 2.0 * f);
            
            // Mix 4 corners
            return mix(a, b, u.x) + 
                  (c - a) * u.y * (1.0 - u.x) + 
                  (d - b) * u.x * u.y;
          }

          // Function to get a color based on position and time
          vec3 getPixelColor(vec2 pos, float time, vec2 mousePos) {
            // Distance from mouse position (normalized)
            float mouseDist = length(pos - mousePos);
            float mouseInfluence = smoothstep(0.5, 0.0, mouseDist);
            
            // Base color using position and time
            vec3 color = 0.5 + 0.5 * cos(time + pos.xyx + vec3(0, 2, 4));
            
            // Add mouse influence to color
            color = mix(color, vec3(1.0 - color.r, 1.0 - color.g, 1.0 - color.b), mouseInfluence * 0.5);
            
            // Add some noise variation
            float noiseVal = noise(pos * 5.0 + time * 0.2) * 0.2;
            color += noiseVal;
            
            return color;
          }

          void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution.xy;
            
            // Normalize coordinates
            vec2 pos = uv * 2.0 - 1.0;
            pos.x *= u_resolution.x / u_resolution.y; // Correct aspect ratio
            
            // Mouse position (normalized)
            vec2 mousePos = u_mouse / u_resolution.xy;
            mousePos = mousePos * 2.0 - 1.0;
            mousePos.x *= u_resolution.x / u_resolution.y;
            
            // Calculate mouse influence for grid size
            float mouseDist = length(pos - mousePos);
            float mouseInfluence = smoothstep(0.8, 0.0, mouseDist);
            
            // Grid size (affected by mouse position)
            float baseGridSize = 20.0;
            float gridSize = baseGridSize + mouseInfluence * 15.0;
            
            // Calculate grid cell
            vec2 grid = floor(uv * gridSize) / gridSize;
            
            // Add some movement to grid cells
            float cellTime = u_time * 0.5 + noise(grid * 5.0) * 2.0;
            
            // Get color for this pixel
            vec3 color = getPixelColor(grid, cellTime, mousePos);
            
            // Add grid lines
            vec2 gridUV = fract(uv * gridSize);
            float gridLine = smoothstep(0.95, 0.98, max(gridUV.x, gridUV.y));
            color = mix(color, vec3(0.0), gridLine * 0.3);
            
            // Add pulsating effect to each cell
            float pulse = 0.5 + 0.5 * sin(cellTime * 3.0 + length(grid) * 5.0);
            color *= 0.7 + pulse * 0.3;
            
            // Add vignette effect
            float vignette = smoothstep(1.0, 0.3, length(pos * 0.8));
            color *= vignette;
            
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      </script>
    </div>
  );
};

export default Rainbow;