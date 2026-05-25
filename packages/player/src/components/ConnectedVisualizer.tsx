import { FC, useEffect, useRef } from 'react';

import { useSoundStore } from '../stores/soundStore';
import { useVisualizerStore } from '../stores/visualizerStore';

const BAR_COUNT = 48;
const CANVAS_WIDTH = 180;
const CANVAS_HEIGHT = 36;
const BAR_COLOR_BOTTOM = 'oklch(0.88 0.13 145)';
const BAR_COLOR_TOP = 'oklch(0.88 0.09 200)';
const BAR_IDLE_COLOR = 'oklch(0.4 0 0 / 0.35)';
const BAR_IDLE_HEIGHT = 2;
const BAR_MIN_HEIGHT = 2;

export const ConnectedVisualizer: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frequencyData = useVisualizerStore((state) => state.frequencyData);
  const status = useSoundStore((state) => state.status);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const barWidth = CANVAS_WIDTH / BAR_COUNT;

    if (!frequencyData || status !== 'playing') {
      ctx.fillStyle = BAR_IDLE_COLOR;
      for (let barIndex = 0; barIndex < BAR_COUNT; barIndex++) {
        ctx.fillRect(
          barIndex * barWidth + 1,
          CANVAS_HEIGHT - BAR_IDLE_HEIGHT,
          barWidth - 2,
          BAR_IDLE_HEIGHT,
        );
      }
      return;
    }

    const step = Math.floor(frequencyData.length / BAR_COUNT);
    const gradient = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, 0);
    gradient.addColorStop(0, BAR_COLOR_BOTTOM);
    gradient.addColorStop(1, BAR_COLOR_TOP);
    ctx.fillStyle = gradient;

    for (let barIndex = 0; barIndex < BAR_COUNT; barIndex++) {
      const value = frequencyData[barIndex * step] / 255;
      const barHeight = Math.max(BAR_MIN_HEIGHT, value * CANVAS_HEIGHT);
      ctx.fillRect(
        barIndex * barWidth + 1,
        CANVAS_HEIGHT - barHeight,
        barWidth - 2,
        barHeight,
      );
    }
  }, [frequencyData, status]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="opacity-60"
      aria-hidden
    />
  );
};
