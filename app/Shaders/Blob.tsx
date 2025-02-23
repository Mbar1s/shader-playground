"use client"
import React, { useEffect, useRef } from 'react';

const Blob: React.FC = () => {
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
        y: canvas.height - event.clientY // Flip Y coordinate for WebGL
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

    // Fragment shader source
    const fragmentShaderSource = `
      precision highp float;
      
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_time;

      // Noise function
      vec2 random2(vec2 p) {
        return fract(sin(vec2(
          dot(p, vec2(127.1, 311.7)),
          dot(p, vec2(269.5, 183.3))
        )) * 43758.5453);
      }

      // Voronoi noise for distortion
      float voronoi(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float minDist = 1.0;
        
        for(int y = -1; y <= 1; y++) {
          for(int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = random2(i + neighbor);
            point = 0.5 + 0.5 * sin(u_time * 0.5 + 6.2831 * point);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            minDist = min(minDist, dist);
          }
        }
        return minDist;
      }

      // Enhanced metaball function with distortion
      float metaball(vec2 p, vec2 center, float radius, float distortAmount) {
        // Add time-based movement to radius
        float r = radius * (0.8 + 0.4 * sin(u_time * 2.0 + length(center)));
        
        // Add distortion
        vec2 distortedP = p + vec2(
          sin(p.y * 0.1 + u_time) * distortAmount,
          cos(p.x * 0.1 + u_time) * distortAmount
        );
        
        // Add noise-based distortion
        float noise = voronoi(distortedP * 0.01 + u_time * 0.1) * 2.0;
        distortedP += vec2(noise) * distortAmount * 10.0;
        
        // Calculate metaball field
        float dist = length(distortedP - center);
        return (r * r) / (dist * dist + noise * 5.0);
      }

      // Color palette function
      vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263, 0.416, 0.557);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        vec2 pixel = vec2(gl_FragCoord.x, gl_FragCoord.y);
        
        // Mouse position with trail effect
        vec2 mouse = u_mouse.xy;
        
        // Calculate multiple metaballs with different behaviors
        float v = 0.0;
        
        // Create a grid of metaballs
        for(int i = 0; i < 5; i++) {
          for(int j = 0; j < 5; j++) {
            vec2 center = vec2(
              u_resolution.x * (0.2 + 0.6 * float(i) / 4.0 + 0.1 * sin(u_time * 0.5 + float(i))),
              u_resolution.y * (0.2 + 0.6 * float(j) / 4.0 + 0.1 * cos(u_time * 0.7 + float(j)))
            );
            
            float radius = 30.0 + 10.0 * sin(u_time + float(i * j));
            float distort = 2.0 + sin(u_time * 0.3 + float(i + j));
            
            v += metaball(pixel, center, radius, distort);
          }
        }
        
        // Add mouse-controlled metaballs with trails
        for(int i = 0; i < 3; i++) {
          float t = u_time - float(i) * 0.2;
          vec2 trailPos = mouse + vec2(
            sin(t * 2.0) * 100.0,
            cos(t * 1.5) * 100.0
          );
          v += metaball(pixel, trailPos, 40.0 + float(i) * 10.0, 1.0);
        }
        
        // Dynamic threshold based on time
        float threshold = 1.0 + 0.2 * sin(u_time);
        
        // Color calculation with enhanced effects
        vec3 color = vec3(0.0);
        if (v > threshold) {
            // Inside the metaball - use palette function
            float colorIndex = v * 0.2 + u_time * 0.1;
            color = palette(colorIndex);
            
            // Add texture based on voronoi noise
            float noise = voronoi(pixel * 0.02 + u_time * 0.1);
            color *= 0.8 + 0.2 * noise;
        }
        
        // Enhanced glow effect
        float glow = smoothstep(threshold - 1.0, threshold, v) * 0.8;
        color += palette(u_time * 0.1) * glow;
        
        // Add subtle noise to the entire scene
        color += vec3(random2(pixel * 0.001).x) * 0.05;
        
        // Gamma correction
        color = pow(color, vec3(0.8));
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

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

    // Animation function
    const render = () => {
      timeRef.current += 0.01;
      
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // Update uniforms
      gl.uniform1f(timeLocation, timeRef.current);
      gl.uniform2f(mouseLocation, mouseRef.current.x, mouseRef.current.y);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

      // Set up position attribute
      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Draw
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameId = requestAnimationFrame(render);
    };

    // Start animation
    render();

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        background: 'black'
      }}
    />
  );
};

export default Blob;