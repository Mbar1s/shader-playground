"use client"
import React, { useEffect, useRef } from 'react';

const Space: React.FC = () => {
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
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current = {
        x: event.clientX / window.innerWidth,
        y: 1.0 - event.clientY / window.innerHeight,
      };
    };

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;

      #define NUM_PARTICLES 100.0
      #define PARTICLE_SIZE 0.015
      
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }
      
      vec2 hash2(vec2 p) {
        p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
        return -1.0 + 2.0 * fract(sin(p)*43758.5453123);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        
        vec2 u = f*f*(3.0-2.0*f);
        
        return mix(mix(dot(hash2(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
                      dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
                  mix(dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
                      dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
      }
      
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
        vec3 finalColor = vec3(0.0);
        
        // Background
        vec3 bgColor = vec3(0.02, 0.02, 0.05);
        finalColor = bgColor;
        
        // Stars/Particles
        for(float i = 0.0; i < NUM_PARTICLES; i++) {
          vec2 particlePos = vec2(
            random(vec2(i, 0.0)) * 2.0 - 1.0,
            random(vec2(0.0, i)) * 2.0 - 1.0
          );
          
          // Add movement
          particlePos.x += sin(u_time * 0.5 + i) * 0.1;
          particlePos.y += cos(u_time * 0.3 + i) * 0.1;
          
          // Wrap around screen
          particlePos = fract(particlePos) * 2.0 - 1.0;
          
          float particle = length(uv - particlePos);
          
          // Particle color and intensity
          vec3 particleColor = vec3(0.9, 0.95, 1.0);
          float brightness = 0.06 / particle;
          brightness *= smoothstep(PARTICLE_SIZE, 0.0, particle);
          
          // Add some color variation based on position
          particleColor *= 1.0 + 0.5 * vec3(sin(i * 0.067), sin(i * 0.089), sin(i * 0.029));
          
          finalColor += particleColor * brightness;
        }
        
        // Add subtle nebula effect
        vec2 q = uv + vec2(u_time * 0.05);
        float f = 0.0;
        f += 0.5 * noise(q * 2.0);
        f += 0.25 * noise(q * 4.0);
        f += 0.125 * noise(q * 8.0);
        vec3 nebulaColor = vec3(0.4, 0.2, 0.8) * f * 0.15;
        finalColor += nebulaColor;
        
        // Add mouse interaction glow
        float mouseGlow = length(uv - (u_mouse * 2.0 - 1.0));
        finalColor += vec3(0.3, 0.4, 1.0) * (0.05 / mouseGlow) * 0.2;
        
        // Tone mapping and gamma correction
        finalColor = pow(finalColor, vec3(0.8));
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    const vertices = new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const timeUniform = gl.getUniformLocation(program, 'u_time');
    const resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
    const mouseUniform = gl.getUniformLocation(program, 'u_mouse');

    const render = () => {
      timeRef.current += 0.005;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.uniform1f(timeUniform, timeRef.current);
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
      gl.uniform2f(mouseUniform, mouseRef.current.x, mouseRef.current.y);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    };

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

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
};

export default Space;