import type { TabDefinition } from '../drawer';
import { audioTab } from './audio';
import { canvasApiTab } from './canvasApi';
import { consoleTab } from './console';
import { metersTab } from './meters';
import { propertiesTab } from './properties';
import { rendererTab } from './renderer';
import { screenTab } from './screen';
import { viewTab } from './view';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [
  propertiesTab,
  audioTab,
  screenTab,
  metersTab,
  canvasApiTab,
  rendererTab,
  viewTab,
  consoleTab,
];
