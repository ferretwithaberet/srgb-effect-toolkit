import { ctorName } from '../log';
import { properties } from '../manifest';
import { handlerName, propertyNames } from '../names';
import { readGlobal } from '../state';

/** Raw value, type and constructor of each property global, read now. */
export const collectPropertyValues = () => {
  const values: Record<string, unknown> = {};
  for (const name of propertyNames) {
    const value = readGlobal(name);
    values[name] = {
      value,
      typeof: typeof value,
      ctor: ctorName(value),
      inWindow: name in window,
    };
  }
  return values;
};

/** Property values, and what each handler was before the probe assigned its own. */
export const collectProperties = () => {
  const values = collectPropertyValues();
  const handlersBefore: Record<string, string> = {};
  for (const name of propertyNames) {
    handlersBefore[handlerName(name)] = typeof readGlobal(handlerName(name));
  }
  handlersBefore.onCanvasApiEvent = typeof readGlobal('onCanvasApiEvent');
  return { declared: properties.length, values, handlersBefore };
};
