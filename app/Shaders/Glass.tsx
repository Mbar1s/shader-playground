"use client"
import React, { useEffect, useRef } from 'react';

const Glass: React.FC = () => {
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
        y: canvas.height - event.clientY
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

      // Improved noise functions
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      vec2 random2(vec2 p) {
        return fract(sin(vec2(
          dot(p, vec2(127.1, 311.7)),
          dot(p, vec2(269.5, 183.3))
        )) * 43758.5453);
      }

      // Enhanced voronoi with sharper edges
      float voronoi(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        
        float minDist = 1.0;
        float secondMinDist = 1.0;
        vec2 minPoint;
        
        for(int y = -1; y <= 1; y++) {
          for(int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = random2(i + neighbor);
            point = 0.5 + 0.5 * sin(u_time * 0.2 + 6.2831 * point);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            
            if(dist < minDist) {
              secondMinDist = minDist;
              minDist = dist;
              minPoint = point;
            } else if(dist < secondMinDist) {
              secondMinDist = dist;
            }
          }
        }
        
        // Calculate edge distance
        float edgeWidth = 0.05;
        float edge = smoothstep(edgeWidth, 0.0, abs(secondMinDist - minDist));
        
        return minDist + edge * 0.1;
      }

      // Enhanced Fresnel effect
      float fresnel(float cosTheta, float F0, float roughness) {
        return F0 + (max(1.0 - roughness, F0) - F0) * pow(1.0 - cosTheta, 5.0);
      }

      // Improved color palette for glass
      vec3 palette(float t) {
        // More vibrant and glass-like colors
        vec3 a = vec3(0.8, 0.8, 0.8);   // Ambient color
        vec3 b = vec3(0.8, 0.8, 0.9);   // Color variation
        vec3 c = vec3(1.0, 1.0, 1.0);   // Frequency
        vec3 d = vec3(0.0, 0.1, 0.2);   // Phase
        return a + b * cos(6.28318 * (c * t + d));
      }

      // Environment mapping simulation
      vec3 envMap(vec2 p) {
        float t = length(p - 0.5) * 2.0;
        return mix(
          vec3(0.2, 0.5, 1.0),  // Sky blue
          vec3(1.0, 0.9, 0.8),  // Warm light
          t
        );
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        vec2 mouseNorm = u_mouse / u_resolution.xy;
        
        // Enhanced distortion based on mouse position
        float distanceToMouse = length(st - mouseNorm);
        vec2 distortion = normalize(st - mouseNorm) * 0.15 * 
          (1.0 - smoothstep(0.0, 0.7, distanceToMouse));
        
        // Multiple layers of glass patterns
        float scale1 = 6.0;
        float scale2 = 12.0;
        vec2 voronoiCoord1 = (st + distortion) * scale1;
        vec2 voronoiCoord2 = (st + distortion * 0.5) * scale2;
        
        float v1 = voronoi(voronoiCoord1 + vec2(u_time * 0.05));
        float v2 = voronoi(voronoiCoord2 - vec2(u_time * 0.03));
        
        // Combine patterns for more complex glass structure
        float pattern = mix(
          smoothstep(0.1, 0.2, v1),
          smoothstep(0.05, 0.15, v2),
          0.5
        );
        
        // Enhanced view angle calculation
        vec3 viewDir = normalize(vec3(st - mouseNorm, 1.0));
        float viewAngle = abs(dot(viewDir, vec3(0.0, 0.0, 1.0)));
        
        // Multi-layer refraction
        vec2 refractedUV1 = st + distortion * (1.0 - pattern) * 0.3;
        vec2 refractedUV2 = st + distortion * pattern * 0.2;
        
        // Environment reflection
        vec3 envColor = envMap(st + distortion * 0.1);
        
        // Enhanced Fresnel with roughness
        float roughness = mix(0.1, 0.4, pattern);
        float F0 = 0.04;  // Base reflectivity for glass
        float fresnel = fresnel(viewAngle, F0, roughness);
        
        // Combine multiple layers with environment
        vec3 refractedColor1 = palette(length(refractedUV1) + u_time * 0.1);
        vec3 refractedColor2 = palette(length(refractedUV2) - u_time * 0.08);
        
        vec3 finalColor = mix(
          mix(refractedColor1, refractedColor2, pattern),
          envColor,
          fresnel
        );
        
        // Enhanced chromatic aberration
        float aberration = mix(0.02, 0.04, pattern);
        finalColor.r += pattern * aberration;
        finalColor.b -= pattern * aberration;
        
        // Add subtle highlights
        float highlight = pow(1.0 - distanceToMouse, 4.0) * 0.2;
        finalColor += vec3(highlight);
        
        // Add subtle internal reflections
        float internalReflection = pow(pattern, 2.0) * 0.15;
        finalColor += vec3(1.0, 1.0, 1.0) * internalReflection;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    // Create and compile shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    // Create program
    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    // Set up position buffer
    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Set up vertex attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
    const timeLocation = gl.getUniformLocation(program, 'u_time');

    // Animation loop
    const render = () => {
      timeRef.current += 0.01;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(mouseLocation, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1f(timeLocation, timeRef.current);

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

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
};

export default Glass;