import { createLoop, getFrequencies, hexToHsl, hsl, isSilent } from 'srgb-effect-kit';

const ctx = document.querySelector('canvas')!.getContext('2d')!;
const BARS = 40;
const BAR_WIDTH = 320 / BARS;

createLoop(() => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 200);
  if (isSilent()) return;

  const freq = getFrequencies();
  const base = hexToHsl(tint);
  const binsPerBar = Math.floor(freq.length / BARS);

  for (let bar = 0; bar < BARS; bar += 1) {
    let sum = 0;
    for (let i = 0; i < binsPerBar; i += 1) sum += freq[bar * binsPerBar + i]!;
    const level = Math.min(1, (sum / binsPerBar / 255) * (gain / 50));
    const height = level * 200;
    ctx.fillStyle = hsl((base.h + (bar * hueSpread) / 10) % 360, base.s, base.l);
    ctx.fillRect(bar * BAR_WIDTH, 200 - height, BAR_WIDTH - 1, height);
  }
}).start();
