import { ctorName } from '../log';
import { properties } from '../manifest';
import { handlerName, propertyNames } from '../names';
import { readGlobal } from '../state';

/** Raw value and type of each property global, and what each handler was before the probe. */
export const collectProperties = () => {
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
  const handlersBefore: Record<string, string> = {};
  for (const name of propertyNames)
    handlersBefore[handlerName(name)] = typeof readGlobal(handlerName(name));
  handlersBefore.onCanvasApiEvent = typeof readGlobal('onCanvasApiEvent');
  return { declared: properties.length, values, handlersBefore };
};
