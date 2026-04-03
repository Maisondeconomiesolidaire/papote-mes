"use client";

import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
  volume: number; // 0-1
  isSpeaking: boolean;
  color?: string;
}

const BAR_COUNT = 64;
const BASE_RADIUS = 90;
const BAR_WIDTH = 3;
const MAX_BAR_HEIGHT = 50;
const MIN_BAR_HEIGHT = 2;

export default function AudioVisualizer({
  isActive,
  volume,
  isSpeaking,
  color = "#34d399",
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const smoothVolumeRef = useRef(0);
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    function draw() {
      if (!ctx || !canvas) return;

      // Smooth volume interpolation
      const targetVol = isActive ? volume : 0;
      smoothVolumeRef.current += (targetVol - smoothVolumeRef.current) * 0.15;
      const vol = smoothVolumeRef.current;

      timeRef.current += 0.02;
      const t = timeRef.current;

      ctx.clearRect(0, 0, 320, 320);

      const cx = 160;
      const cy = 160;
      const bars = barsRef.current;

      for (let i = 0; i < BAR_COUNT; i++) {
        const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;

        // Generate target height from volume + sine waves for organic feel
        let targetHeight: number;
        if (isActive && vol > 0.01) {
          const wave1 = Math.sin(t * 3 + i * 0.4) * 0.5 + 0.5;
          const wave2 = Math.sin(t * 5 + i * 0.2) * 0.3 + 0.5;
          const wave3 = Math.sin(t * 1.5 + i * 0.8) * 0.2 + 0.5;
          const combined = (wave1 + wave2 + wave3) / 3;
          targetHeight = MIN_BAR_HEIGHT + combined * vol * MAX_BAR_HEIGHT;
        } else {
          // Idle: subtle ambient breathing
          const idle = Math.sin(t * 0.8 + i * 0.3) * 0.3 + 0.5;
          targetHeight = MIN_BAR_HEIGHT + idle * 3;
        }

        // Smooth each bar independently
        bars[i] += (targetHeight - bars[i]) * 0.2;
        const h = bars[i];

        const x1 = cx + Math.cos(angle) * BASE_RADIUS;
        const y1 = cy + Math.sin(angle) * BASE_RADIUS;
        const x2 = cx + Math.cos(angle) * (BASE_RADIUS + h);
        const y2 = cy + Math.sin(angle) * (BASE_RADIUS + h);

        // Color with opacity based on height
        const opacity = 0.3 + (h / MAX_BAR_HEIGHT) * 0.7;
        ctx.strokeStyle = hexToRgba(color, opacity);
        ctx.lineWidth = BAR_WIDTH;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Glow ring
      if (vol > 0.01 && isActive) {
        ctx.beginPath();
        ctx.arc(cx, cy, BASE_RADIUS - 2, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(color, 0.15 + vol * 0.25);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, volume, isSpeaking, color]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: 320, height: 320 }}
    />
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
