import type { TabDefinition } from '../drawer';
import { audioTab } from './audio';
import { metersTab } from './meters';
import { propertiesTab } from './properties';
import { screenTab } from './screen';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [propertiesTab, audioTab, screenTab, metersTab];
