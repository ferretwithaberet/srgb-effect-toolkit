/** Name of the global change handler SignalRGB calls for a property. */
export const handlerName = (property: string): string =>
  `on${property.charAt(0).toUpperCase()}${property.slice(1)}Changed`;

export const kebabCase = (input: string): string =>
  input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'effect';
