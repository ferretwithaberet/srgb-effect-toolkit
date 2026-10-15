import { createLoop, getCanvas, hsl, parseBoolean } from 'srgb-effect-kit';

const { ctx } = getCanvas();
const COLUMN = 4;
let hue = baseHue;

// SignalRGB calls this on load and whenever the slider moves.
window.onBaseHueChanged = () => {
  hue = baseHue;
};

createLoop(({ dt, time }) => {
  hue = (hue + speed * 3.6 * dt) % 360;
  const lightness = mode === 'Pulse' ? 35 + 15 * Math.sin(time * 4) : 50;

  for (let x = 0; x < 320; x += COLUMN) {
    const offset = mode === 'Wave' ? (x / 320) * 360 : 0;
    ctx.fillStyle = hsl(parseBoolean(rainbow) ? (hue + offset) % 360 : baseHue, 100, lightness);
    ctx.fillRect(x, 0, COLUMN, 200);
  }
}).start();
