"use client"
import React, { useEffect, useRef } from 'react';

const WaveLine: React.FC = () => {
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

          // Improved noise function
          vec2 hash22(vec2 p) {
            p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
            return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
          }

          // Gradient noise
          float gnoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(dot(hash22(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
                  dot(hash22(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
              mix(dot(hash22(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
                  dot(hash22(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x),
              u.y
            );
          }

          // FBM (Fractal Brownian Motion)
          float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            for(int i = 0; i < 5; i++) {
              value += amplitude * gnoise(p * frequency);
              frequency *= 2.0;
              amplitude *= 0.5;
            }
            return value;
          }

          // Function to create a single line
          float createLine(vec2 uv, float lineIndex, float mouseInfluence) {
            float t = u_time * 0.5;
            
            // Mouse influence on the wave
            vec2 mousePos = u_mouse / u_resolution;
            mousePos = mousePos * 2.0 - 1.0;
            mousePos.x *= u_resolution.x/u_resolution.y;
            
            float mouseDist = length(uv - mousePos);
            float mouseEffect = exp(-mouseDist * 3.0) * mouseInfluence;
            
            // Create base wave with multiple frequencies
            float wave = sin(uv.x * 3.0 + t + lineIndex) * 0.3;
            wave += sin(uv.x * 5.0 - t * 1.2 + lineIndex * 2.0) * 0.2;
            wave += sin(uv.x * 7.0 + t * 0.8 + lineIndex * 4.0) * 0.1;
            
            // Add noise and mouse interaction
            wave += fbm(vec2(uv.x * 4.0 + lineIndex, t * 0.5)) * 0.1;
            wave += mouseEffect * sin(mouseDist * 10.0 + t * 2.0) * 0.2;
            
            // Offset the wave based on the line index
            wave += lineIndex * 0.4 - 1.0;
            
            // Calculate distance from wave
            float dist = abs(uv.y - wave);
            float line = smoothstep(0.02, 0.01, dist);
            float glow = smoothstep(0.1, 0.0, dist) * 0.5;
            
            return line + glow;
          }

          void main() {
            vec2 uv = gl_FragCoord.xy/u_resolution.xy;
            uv = uv * 2.0 - 1.0;
            uv.x *= u_resolution.x/u_resolution.y;
            
            vec3 finalColor = vec3(0.0);
            
            // Create multiple lines with different colors and mouse interactions
            for(int i = 0; i < 6; i++) {
              float lineIndex = float(i);
              float t = u_time * 0.5 + lineIndex * 0.5;
              
              // Different mouse influence for each line
              float mouseInfluence = 1.0 - lineIndex * 0.1;
              
              // Generate line
              float line = createLine(uv, lineIndex, mouseInfluence);
              
              // Create unique color for each line
              vec3 color = 0.5 + 0.5 * cos(t + lineIndex * 0.5 + vec3(0.0, 2.0, 4.0));
              
              // Add line to final color with alpha blending
              finalColor += color * line * 0.5;
            }
            
            // Output final color with some post-processing
            finalColor = pow(finalColor, vec3(0.8)); // Gamma correction
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
      </script>
    </div>
  );
};

export default WaveLine;