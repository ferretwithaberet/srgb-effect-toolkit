import { meters, properties } from './manifest';

/** Name of the global change handler SignalRGB calls for a property (`pNumber` → `onPNumberChanged`). */
export const handlerName = (property: string): string =>
  `on${property.charAt(0).toUpperCase()}${property.slice(1)}Changed`;

export const propertyNames: readonly string[] = properties.map((p) => p.property);
export const meterNames: readonly string[] = meters.map((m) => m.meter);
