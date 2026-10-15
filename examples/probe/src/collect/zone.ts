import { ctorName, serialize } from '../log';
import { keysOf } from '../describe';
import { getEngine } from './engine';

/** Length, constructor, range and a sample of each `engine.zone` channel. */
export const collectZone = () => {
  const engine = getEngine();
  const zone = engine ? (engine.zone as Record<string, unknown> | undefined) : undefined;
  if (!zone || typeof zone !== 'object') return { zoneTypeof: typeof zone };
  const channels: Record<string, unknown> = {};
  for (const key of keysOf(zone)) {
    const channel = zone[key] as ArrayLike<unknown> | undefined;
    if (!channel || typeof channel.length !== 'number') {
      channels[key] = { typeof: typeof channel };
      continue;
    }
    let min: number | null = null;
    let max: number | null = null;
    let nonFinite = 0;
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        nonFinite++;
        continue;
      }
      min = min === null ? value : Math.min(min, value);
      max = max === null ? value : Math.max(max, value);
    }
    channels[key] = {
      length: channel.length,
      ctor: ctorName(channel),
      isArray: Array.isArray(channel),
      min,
      max,
      nonFinite,
      sample: serialize(Array.prototype.slice.call(channel, 0, 16)),
    };
  }
  return { zoneTypeof: typeof zone, channels };
};
