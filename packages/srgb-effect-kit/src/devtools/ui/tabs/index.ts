import type { TabDefinition } from '../drawer';
import { audioTab } from './audio';
import { propertiesTab } from './properties';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [propertiesTab, audioTab];
