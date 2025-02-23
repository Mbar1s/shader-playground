"use client"
import { useEffect, useRef, useState } from 'react';

const GlitchGradient = () => {
  const canvasRef = useRef(null);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const mouseSpeedRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

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
      uniform bool isHovered;
      
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

      // Enhanced wave function with more frequencies and modulation
      float wave(vec2 uv, float time) {
        float wave1 = sin(uv.x * 6.0 + time * 2.0 + sin(time * 0.5) * 2.0) * 0.5;
        float wave2 = sin(uv.x * 12.0 - time * 3.0 + cos(time * 0.7) * 1.5) * 0.25;
        float wave3 = sin(uv.x * 18.0 + time * 1.5 + sin(time * 0.3) * 3.0) * 0.125;
        float wave4 = sin(uv.x * 24.0 - time * 4.0 + cos(time * 0.9) * 2.0) * 0.0625;
        float wave5 = sin(uv.y * 10.0 + time * 2.5) * 0.15;
        return wave1 + wave2 + wave3 + wave4 + wave5;
      }

      // Enhanced glitch displacement with multiple layers
      vec2 glitchOffset(vec2 uv, float intensity, float time) {
        float glitchNoise1 = noise(uv * 50.0 + time * 5.0);
        float glitchNoise2 = noise(uv * 30.0 - time * 3.0);
        float glitchNoise3 = noise(uv * 70.0 + time * 7.0);
        
        float glitchStrength1 = step(0.98 - intensity * 0.3, glitchNoise1);
        float glitchStrength2 = step(0.95 - intensity * 0.2, glitchNoise2);
        float glitchStrength3 = step(0.97 - intensity * 0.25, glitchNoise3);
        
        vec2 offset1 = vec2(sin(glitchNoise1 * 6.28), cos(glitchNoise1 * 6.28)) * intensity;
        vec2 offset2 = vec2(cos(glitchNoise2 * 4.28), sin(glitchNoise2 * 4.28)) * intensity * 0.7;
        vec2 offset3 = vec2(sin(glitchNoise3 * 8.28), cos(glitchNoise3 * 8.28)) * intensity * 0.5;
        
        return offset1 * glitchStrength1 + offset2 * glitchStrength2 + offset3 * glitchStrength3;
      }

      // Kaleidoscope effect
      vec2 kaleidoscope(vec2 uv, float time) {
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        float segments = 8.0;
        angle = mod(angle + time * 0.2, 6.28 / segments);
        return vec2(cos(angle), sin(angle)) * radius;
      }
      
      void main() {
        vec2 uv = gl_FragCoord.xy/resolution.xy;
        vec2 mouseUV = mouse/resolution.xy;
        float t = time * 0.5;
        
        // Calculate distance from mouse with spiral distortion
        vec2 distortedUV = uv - mouseUV;
        float angle = atan(distortedUV.y, distortedUV.x);
        float radius = length(distortedUV);
        radius += sin(angle * 3.0 + t) * 0.1;
        float mouseDist = radius;
        
        // Enhanced wave colors with time variation and hover effect
        vec3 waveColor1 = isHovered 
          ? vec3(0.9 + sin(t * 0.5) * 0.1, 0.2 + cos(t * 0.7) * 0.2, 0.5 + sin(t * 0.3) * 0.2)
          : vec3(0.7 + sin(t * 0.5) * 0.3, 0.0, 0.3 + cos(t * 0.7) * 0.2);
        vec3 waveColor2 = isHovered
          ? vec3(0.4 + cos(t * 0.4) * 0.2, 0.6 + sin(t * 0.5) * 0.2, 0.8 + cos(t * 0.3) * 0.2)
          : vec3(0.2, 0.0 + sin(t * 0.3) * 0.2, 0.5 + cos(t * 0.4) * 0.3);
        vec3 glowColor = isHovered
          ? vec3(0.4 + sin(t) * 0.3, 0.8 + cos(t * 0.8) * 0.2, 1.0)
          : vec3(1.0, 0.2 + sin(t) * 0.3, 0.4 + cos(t * 0.8) * 0.2);
        
        // Apply complex wave distortion
        vec2 waveUV = uv;
        float waveHeight = wave(waveUV, t);
        waveUV.y += waveHeight * (isHovered ? 0.25 : 0.15);
        waveUV.x += waveHeight * (isHovered ? 0.08 : 0.05) * sin(t);
        
        // Apply enhanced glitch based on mouse speed
        float glitchIntensity = mouseSpeed * (isHovered ? 0.05 : 0.03);
        vec2 glitchUV = waveUV;
        if (mouseSpeed > 0.05) {
          vec2 offset = glitchOffset(waveUV, glitchIntensity, t);
          glitchUV += offset * smoothstep(0.7, 0.0, mouseDist);
          
          // Multiple layers of glitch lines
          float glitchLine1 = step(0.99, noise(vec2(t * 10.0, glitchUV.y * 100.0)));
          float glitchLine2 = step(0.98, noise(vec2(t * 15.0, glitchUV.y * 150.0)));
          glitchUV.x += (glitchLine1 * 0.03 + glitchLine2 * 0.02) * mouseSpeed;
          glitchUV.y += (glitchLine1 * 0.01 - glitchLine2 * 0.01) * mouseSpeed;
        }

        // Apply kaleidoscope effect
        glitchUV = mix(glitchUV, kaleidoscope(glitchUV - 0.5, t) + 0.5, mouseSpeed * (isHovered ? 0.5 : 0.3));
        
        // Create complex wave pattern
        float finalWave = wave(glitchUV, t);
        float wavePattern = smoothstep(-0.3, 0.3, finalWave);
        
        // Enhanced base color with wave interaction
        vec3 baseColor = mix(waveColor2, waveColor1, wavePattern);
        baseColor *= 1.0 + sin(glitchUV.x * 30.0 + t * 5.0) * 0.1;
        
        // Add dynamic noise texture
        float n = noise(glitchUV * (5.0 + sin(t) * 2.0) + t) * (isHovered ? 0.3 : 0.2);
        baseColor += n * glowColor;
        
        // Enhanced mouse interaction
        float mouseEffect = smoothstep(0.4, 0.0, mouseDist);
        if (mouseEffect > 0.0) {
            // Add pulsing glow near mouse
            float pulse = (1.0 + sin(t * 10.0)) * 0.5;
            baseColor = mix(baseColor, glowColor * (1.0 + pulse * 0.5), mouseEffect * (isHovered ? 0.8 : 0.6));
            
            // Enhanced RGB split based on mouse movement
            if (mouseSpeed > 0.05) {
                vec2 rgbOffset = vec2(0.02, 0.02) * mouseSpeed;
                float r = noise(glitchUV + rgbOffset + vec2(t * 0.1, 0.0));
                float g = noise(glitchUV + vec2(sin(t) * 0.02, cos(t) * 0.02));
                float b = noise(glitchUV - rgbOffset - vec2(t * 0.1, 0.0));
                baseColor.r += r * 0.3 * mouseSpeed;
                baseColor.g += g * 0.15 * mouseSpeed;
                baseColor.b += b * 0.3 * mouseSpeed;
            }
        }
        
        // Enhanced digital interference
        float interference = sin(glitchUV.y * 400.0 + t * 20.0) * sin(glitchUV.x * 200.0 - t * 10.0) * (isHovered ? 0.08 : 0.05);
        baseColor += interference * glowColor;
        
        // Dynamic scan lines
        float scanLine = sin(glitchUV.y * (200.0 + sin(t) * 50.0)) * (isHovered ? 0.08 : 0.05);
        baseColor += scanLine * glowColor;
        
        // Enhanced vignette with pulse
        float vignetteStrength = 1.2 + sin(t * 2.0) * 0.2;
        float vignette = 1.0 - length((uv - 0.5) * vignetteStrength);
        vignette = smoothstep(0.0, 0.7, vignette);
        baseColor *= vignette;
        
        // Add subtle color aberration at the edges
        float aberration = length(uv - 0.5) * (isHovered ? 0.15 : 0.1);
        baseColor.r *= 1.0 + aberration;
        baseColor.b *= 1.0 - aberration;
        
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
    const isHoveredLocation = gl.getUniformLocation(program, 'isHovered');
    
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
      gl.uniform1i(isHoveredLocation, isHovered ? 1 : 0);
      
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
  }, [isHovered]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full cursor-pointer"
      style={{ zIndex: -1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
};

export default GlitchGradient;