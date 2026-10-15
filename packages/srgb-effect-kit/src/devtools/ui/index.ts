import type { DevtoolsContext } from '../context';
import { mountDrawer, type DrawerHandle } from './drawer';
import { TABS } from './tabs';

/** Mounts the drawer with every tab. */
export function mountUi(context: DevtoolsContext): DrawerHandle {
  return mountDrawer(context, TABS);
}
