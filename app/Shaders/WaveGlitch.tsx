"use client"
import { useEffect, useRef } from 'react';

const WaveGlitchGradient = () => {
  const canvasRef = useRef(null);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const mouseSpeedRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `
      precision highp float;
      uniform float time;
      uniform vec2 resolution;
      uniform vec2 mouse;
      uniform float mouseSpeed;
      
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }
      
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      // Wave function with multiple frequencies
      float wave(vec2 uv, float time) {
        float wave1 = sin(uv.x * 6.0 + time * 2.0) * 0.5;
        float wave2 = sin(uv.x * 12.0 - time * 3.0) * 0.25;
        float wave3 = sin(uv.x * 18.0 + time * 1.5) * 0.125;
        return wave1 + wave2 + wave3;
      }

      // Glitch displacement function
      vec2 glitchOffset(vec2 uv, float intensity, float time) {
        float glitchNoise = noise(uv * 50.0 + time * 5.0);
        float glitchStrength = step(0.98 - intensity * 0.3, glitchNoise);
        vec2 offset = vec2(
          sin(glitchNoise * 6.28) * intensity,
          cos(glitchNoise * 6.28) * intensity
        ) * glitchStrength;
        return offset;
      }
      
      void main() {
        vec2 uv = gl_FragCoord.xy/resolution.xy;
        vec2 mouseUV = mouse/resolution.xy;
        float t = time * 0.5;
        
        // Calculate distance from mouse
        float mouseDist = length(uv - mouseUV);
        
        // Wave colors
        vec3 waveColor1 = vec3(0.7, 0.0, 0.3);  // Deep pink
        vec3 waveColor2 = vec3(0.2, 0.0, 0.5);  // Deep purple
        vec3 glowColor = vec3(1.0, 0.2, 0.4);   // Bright pink
        
        // Apply wave distortion
        vec2 waveUV = uv;
        float waveHeight = wave(waveUV, t);
        waveUV.y += waveHeight * 0.1;
        
        // Apply glitch based on mouse speed
        float glitchIntensity = mouseSpeed * 0.02;
        vec2 glitchUV = waveUV;
        if (mouseSpeed > 0.1) {
          vec2 offset = glitchOffset(waveUV, glitchIntensity, t);
          glitchUV += offset * smoothstep(0.5, 0.0, mouseDist);
          
          // Horizontal glitch lines
          float glitchLine = step(0.99, noise(vec2(t * 10.0, glitchUV.y * 100.0)));
          glitchUV.x += glitchLine * 0.02 * mouseSpeed;
        }
        
        // Create wave pattern
        float finalWave = wave(glitchUV, t);
        float wavePattern = smoothstep(-0.2, 0.2, finalWave);
        
        // Base color with wave interaction
        vec3 baseColor = mix(waveColor2, waveColor1, wavePattern);
        
        // Add noise texture
        float n = noise(glitchUV * 5.0 + t) * 0.15;
        baseColor += n * glowColor;
        
        // Mouse interaction
        float mouseEffect = smoothstep(0.3, 0.0, mouseDist);
        if (mouseEffect > 0.0) {
            // Add glow near mouse
            baseColor = mix(baseColor, glowColor, mouseEffect * 0.5);
            
            // RGB split based on mouse movement
            if (mouseSpeed > 0.1) {
                vec2 rgbOffset = vec2(0.01, 0.01) * mouseSpeed;
                float r = noise(glitchUV + rgbOffset);
                float b = noise(glitchUV - rgbOffset);
                baseColor.r += r * 0.2 * mouseSpeed;
                baseColor.b -= b * 0.2 * mouseSpeed;
            }
        }
        
        // Digital interference effect
        float interference = sin(glitchUV.y * 400.0 + t * 20.0) * 0.03;
        baseColor += interference * glowColor;
        
        // Vertical scan lines
        float scanLine = sin(glitchUV.y * 200.0) * 0.03;
        baseColor += scanLine * glowColor;
        
        // Vignette
        float vignette = 1.0 - length((uv - 0.5) * 1.5) * 0.5;
        baseColor *= vignette;
        
        gl_FragColor = vec4(baseColor, 1.0);
      }
    `);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, 'time');
    const resolutionLocation = gl.getUniformLocation(program, 'resolution');
    const mouseLocation = gl.getUniformLocation(program, 'mouse');
    const mouseSpeedLocation = gl.getUniformLocation(program, 'mouseSpeed');
    
    let startTime = Date.now();
    let mousePos = { x: 0, y: 0 };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = canvas.height - (e.clientY - rect.top);
      
      const dx = newX - prevMouseRef.current.x;
      const dy = newY - prevMouseRef.current.y;
      mouseSpeedRef.current = Math.min(Math.sqrt(dx * dx + dy * dy), 50) / 50;
      
      mousePos = { x: newX, y: newY };
      prevMouseRef.current = { x: newX, y: newY };
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    function animate() {
      const time = (Date.now() - startTime) * 0.001;
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(mouseLocation, mousePos.x, mousePos.y);
      gl.uniform1f(mouseSpeedLocation, mouseSpeedRef.current);
      
      mouseSpeedRef.current *= 0.95;
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full"
      style={{ zIndex: -1 }}
    />
  );
};

export default WaveGlitchGradient;