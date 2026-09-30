"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

import { cn } from "@/lib/utils";

import "./liquid-chrome.css";

export type LiquidChromeProps = {
  baseColor?: [number, number, number];
  speed?: number;
  amplitude?: number;
  frequencyX?: number;
  frequencyY?: number;
  interactive?: boolean;
  className?: string;
};

export function LiquidChrome({
  baseColor = [0.1, 0.1, 0.1],
  speed = 0.2,
  amplitude = 0.3,
  frequencyX = 3,
  frequencyY = 3,
  interactive = true,
  className,
}: LiquidChromeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [baseR, baseG, baseB] = baseColor;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const gl = renderer.gl;
    gl.clearColor(1, 1, 1, 1);

    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    if (!interactive) {
      canvas.style.pointerEvents = "none";
    }

    const vertexShader = `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform vec3 uResolution;
      uniform vec3 uBaseColor;
      uniform float uAmplitude;
      uniform float uFrequencyX;
      uniform float uFrequencyY;
      uniform vec2 uMouse;
      varying vec2 vUv;

      vec4 renderImage(vec2 uvCoord) {
          vec2 fragCoord = uvCoord * uResolution.xy;
          vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

          for (float i = 1.0; i < 10.0; i++){
              uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159);
              uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159);
          }

          vec2 diff = (uvCoord - uMouse);
          float dist = length(diff);
          float falloff = exp(-dist * 20.0);
          float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
          uv += (diff / (dist + 0.0001)) * ripple * falloff;

          vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
          return vec4(color, 1.0);
      }

      void main() {
          vec4 col = vec4(0.0);
          int samples = 0;
          for (int i = -1; i <= 1; i++){
              for (int j = -1; j <= 1; j++){
                  vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
                  col += renderImage(vUv + offset);
                  samples++;
              }
          }
          gl_FragColor = col / float(samples);
      }
    `;

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new Float32Array([
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          ]),
        },
        uBaseColor: { value: new Float32Array([baseR, baseG, baseB]) },
        uAmplitude: { value: amplitude },
        uFrequencyX: { value: frequencyX },
        uFrequencyY: { value: frequencyY },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const width = Math.max(1, container.offsetWidth);
      const height = Math.max(1, container.offsetHeight);
      renderer.setSize(width, height);
      const resUniform = program.uniforms.uResolution.value as Float32Array;
      resUniform[0] = gl.canvas.width;
      resUniform[1] = gl.canvas.height;
      resUniform[2] = gl.canvas.width / gl.canvas.height;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      const mouseUniform = program.uniforms.uMouse.value as Float32Array;
      mouseUniform[0] = x;
      mouseUniform[1] = y;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const rect = container.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;
      const y = 1 - (touch.clientY - rect.top) / rect.height;
      const mouseUniform = program.uniforms.uMouse.value as Float32Array;
      mouseUniform[0] = x;
      mouseUniform[1] = y;
    };

    if (interactive) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("touchmove", handleTouchMove);
    }

    let animationId = 0;
    const update = (time: number) => {
      animationId = window.requestAnimationFrame(update);
      program.uniforms.uTime.value = time * 0.001 * speed;
      renderer.render({ scene: mesh });
    };
    animationId = window.requestAnimationFrame(update);

    container.appendChild(canvas);

    return () => {
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      if (interactive) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("touchmove", handleTouchMove);
      }
      canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [amplitude, baseB, baseG, baseR, frequencyX, frequencyY, interactive, speed]);

  return <div ref={containerRef} className={cn("liquid-chrome-container", className)} />;
}

export default LiquidChrome;
