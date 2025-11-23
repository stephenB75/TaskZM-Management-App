import React, { useEffect, useRef } from 'react';
import { Z_INDEX } from '../lib/layout-constants';
import { useTheme } from '../contexts/ThemeContext';

interface ConfettiProps {
  trigger: boolean;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

export function Confetti({ trigger, onComplete }: ConfettiProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const hasTriggeredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Only trigger once when trigger changes from false to true
    if (!trigger) {
      hasTriggeredRef.current = false;
      // Clean up any running animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    // Prevent re-triggering if already triggered
    if (hasTriggeredRef.current) {
      return;
    }

    hasTriggeredRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create particles with theme-aware colors
    // Use brighter, more vibrant colors in dark mode for better visibility
    const colors = isDark 
      ? ['#9B87E8', '#7B68EE', '#8A7A9A', '#6A8AAA', '#5A8A7A', '#AA8A6A'] // Dark mode: muted but visible
      : ['#E6D5F0', '#C9E4F7', '#B8E6D5', '#FFD6BA', '#9B87E8', '#7B68EE']; // Light mode: pastel colors
    const particleCount = 50;

    particlesRef.current = Array.from({ length: particleCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      };
    });

    let startTime: number | null = null;
    const duration = 2000; // 2 seconds
    let isComplete = false;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((particle) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.1; // Gravity
        particle.rotation += particle.rotationSpeed;

        // Draw particle
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        ctx.restore();

        // Keep particles that are still on screen
        return (
          particle.x > -10 &&
          particle.x < canvas.width + 10 &&
          particle.y < canvas.height + 10
        );
      });

      // Continue animation if there are particles or time hasn't elapsed
      if (particlesRef.current.length > 0 && elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - only call onComplete once
        if (!isComplete) {
          isComplete = true;
          animationFrameRef.current = null;
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Call onComplete callback
          if (onCompleteRef.current) {
            onCompleteRef.current();
          }
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Clear canvas on cleanup
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ 
        zIndex: Z_INDEX.CONFETTI,
        position: 'fixed', 
        top: 0, 
        left: 0 
      }}
    />
  );
}

