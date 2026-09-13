import { useEffect, useRef } from "react";

const WIDTH = 640;
const HEIGHT = 360;

const PALETTE: [number, number, number][] = [
  [15, 57, 73],
  [22, 91, 106],
  [29, 123, 129],
  [41, 160, 157],
];

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function RetroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx.imageSmoothingEnabled = false;

    const image = ctx.createImageData(WIDTH, HEIGHT);
    const { data } = image;
    let time = 0;
    let frame = 0;
    let running = true;

    const render = () => {
      if (!running) return;

      for (let y = 0; y < HEIGHT; y += 1) {
        for (let x = 0; x < WIDTH; x += 1) {
          const u = x / WIDTH;
          const v = y / HEIGHT;

          const distU = u + Math.sin(v * 3 + time * 0.4) * 0.05;
          const distV = v + Math.cos(u * 2 - time * 0.3) * 0.05;
          const dist = Math.sqrt(distU * distU * 1.5 + distV * distV);

          let value = 3.6 - dist * 2.8;
          value += Math.sin(value * Math.PI * 2) * -0.15;
          value = Math.max(0, Math.min(3, value));

          const threshold = BAYER[y % 4][x % 4] / 16;
          const baseIndex = Math.floor(value);
          const remainder = value - baseIndex;
          const colorIndex = remainder > threshold && baseIndex < 3 ? baseIndex + 1 : baseIndex;
          const color = PALETTE[colorIndex];
          const index = (y * WIDTH + x) * 4;

          data[index] = color[0];
          data[index + 1] = color[1];
          data[index + 2] = color[2];
          data[index + 3] = 255;
        }
      }

      ctx.putImageData(image, 0, 0);
      time += 0.015;
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <canvas className="retro-background" ref={canvasRef} aria-hidden="true" />
      <div className="retro-vignette" aria-hidden="true" />
      <div className="retro-scanlines" aria-hidden="true" />
    </>
  );
}
