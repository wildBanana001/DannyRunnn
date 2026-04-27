import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';

interface ParticleBannerProps {
  active: boolean;
  slogan?: string;
}

interface Particle {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  radius: number;
  alpha: number;
  alphaStep: number;
  vx: number;
  vy: number;
  tint: 'white' | 'blue';
  withTail: boolean;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
}

const DEFAULT_SLOGAN = '社畜没有派对';
const MIN_ALPHA = 0.3;
const MAX_ALPHA = 1;
const EDGE_PADDING = 36;

const getParticleCount = (pixelRatio: number) => {
  if (pixelRatio <= 2) {
    return 60;
  }

  if (pixelRatio >= 3) {
    return 150;
  }

  return 100;
};

const createParticles = (width: number, height: number, count: number): Particle[] => {
  return Array.from({ length: count }, () => {
    const duration = 2000 + Math.random() * 4000;
    const speed = Math.max(width, height) / (duration / 16.67);
    const angle = Math.random() * Math.PI * 2;
    const x = Math.random() * width;
    const y = Math.random() * height;

    return {
      x,
      y,
      previousX: x,
      previousY: y,
      radius: 1 + Math.random() * 2,
      alpha: MIN_ALPHA + Math.random() * (MAX_ALPHA - MIN_ALPHA),
      alphaStep: (0.006 + Math.random() * 0.012) * (Math.random() > 0.5 ? 1 : -1),
      vx: Math.cos(angle) * speed * 0.35,
      vy: Math.sin(angle) * speed * 0.35,
      tint: Math.random() > 0.72 ? 'blue' : 'white',
      withTail: Math.random() > 0.74
    };
  });
};

const createNebulae = (width: number, height: number): Nebula[] => {
  return [
    { x: width * 0.16, y: height * 0.28, radius: width * 0.32, alpha: 0.18, color: '#3A2B70' },
    { x: width * 0.76, y: height * 0.2, radius: width * 0.24, alpha: 0.16, color: '#223F7A' },
    { x: width * 0.62, y: height * 0.76, radius: width * 0.3, alpha: 0.12, color: '#4B2E72' }
  ];
};

const ParticleBanner: React.FC<ParticleBannerProps> = ({ active, slogan = DEFAULT_SLOGAN }) => {
  const containerId = useMemo(() => `particle-banner-${Math.random().toString(36).slice(2, 10)}`, []);
  const canvasId = `${containerId}-canvas`;
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const initRetryRef = useRef(0);
  const [canvasReady, setCanvasReady] = useState(false);

  const stopAnimation = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const startAnimation = () => {
    if (!contextRef.current || animationFrameRef.current !== null) {
      return;
    }

    const render = () => {
      const context = contextRef.current;
      const width = widthRef.current;
      const height = heightRef.current;
      if (!context || !width || !height) {
        animationFrameRef.current = null;
        return;
      }

      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, '#0B0E27');
      background.addColorStop(0.55, '#12153A');
      background.addColorStop(1, '#1A0B2E');
      context.clearRect(0, 0, width, height);
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      nebulaeRef.current.forEach((nebula) => {
        const gradient = context.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius);
        gradient.addColorStop(0, `rgba(${nebula.color === '#223F7A' ? '34, 63, 122' : '75, 46, 114'}, ${nebula.alpha})`);
        gradient.addColorStop(1, 'rgba(11, 14, 39, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      });

      particlesRef.current.forEach((particle) => {
        particle.previousX = particle.x;
        particle.previousY = particle.y;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.alpha += particle.alphaStep;

        if (particle.alpha >= MAX_ALPHA || particle.alpha <= MIN_ALPHA) {
          particle.alphaStep *= -1;
          particle.alpha = Math.min(MAX_ALPHA, Math.max(MIN_ALPHA, particle.alpha));
        }

        if (particle.x < -EDGE_PADDING) {
          particle.x = width + EDGE_PADDING;
        } else if (particle.x > width + EDGE_PADDING) {
          particle.x = -EDGE_PADDING;
        }

        if (particle.y < -EDGE_PADDING) {
          particle.y = height + EDGE_PADDING;
        } else if (particle.y > height + EDGE_PADDING) {
          particle.y = -EDGE_PADDING;
        }

        const rgba = particle.tint === 'blue'
          ? `rgba(214, 236, 255, ${particle.alpha})`
          : `rgba(255, 255, 255, ${particle.alpha})`;

        if (particle.withTail) {
          context.beginPath();
          context.moveTo(particle.previousX - particle.vx * 3, particle.previousY - particle.vy * 3);
          context.lineTo(particle.x, particle.y);
          context.lineWidth = Math.max(0.8, particle.radius * 0.7);
          context.strokeStyle = particle.tint === 'blue'
            ? `rgba(214, 236, 255, ${particle.alpha * 0.25})`
            : `rgba(255, 255, 255, ${particle.alpha * 0.2})`;
          context.stroke();
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = rgba;
        context.fill();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    let cancelled = false;

    const initializeCanvas = () => {
      Taro.nextTick(() => {
        Taro.createSelectorQuery()
          .select(`#${canvasId}`)
          .fields({ node: true, size: true }, (result) => {
            if (cancelled) {
              return;
            }

            const canvasInfo = result as { node?: HTMLCanvasElement; width?: number; height?: number } | null;
            const width = canvasInfo?.width ?? 0;
            const height = canvasInfo?.height ?? 0;
            const canvas = canvasInfo?.node;
            const context = canvas?.getContext('2d');

            if (!canvas || !context || !width || !height) {
              if (initRetryRef.current < 4) {
                initRetryRef.current += 1;
                setTimeout(initializeCanvas, 60);
              }
              return;
            }

            const { pixelRatio = 2 } = Taro.getSystemInfoSync();
            canvas.width = width * pixelRatio;
            canvas.height = height * pixelRatio;
            context.scale(pixelRatio, pixelRatio);

            contextRef.current = context;
            widthRef.current = width;
            heightRef.current = height;
            particlesRef.current = createParticles(width, height, getParticleCount(pixelRatio));
            nebulaeRef.current = createNebulae(width, height);
            setCanvasReady(true);
          })
          .exec();
      });
    };

    initializeCanvas();

    return () => {
      cancelled = true;
      stopAnimation();
    };
  }, [canvasId]);

  useEffect(() => {
    if (!canvasReady || !active) {
      stopAnimation();
      return undefined;
    }

    startAnimation();
    return () => stopAnimation();
  }, [active, canvasReady]);

  return (
    <View id={containerId} className={styles.container}>
      <Canvas id={canvasId} canvasId={canvasId} type="2d" className={styles.canvas} />
      <View className={styles.content}>
        <Text className={styles.slogan}>{slogan}</Text>
      </View>
    </View>
  );
};

export default ParticleBanner;
