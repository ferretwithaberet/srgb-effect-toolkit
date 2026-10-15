import type { DevtoolsContext } from '../context';
import { rafBatch } from './dom';
import { mountDrawer, type DrawerHandle } from './drawer';
import { TABS } from './tabs';

/** Mounts the drawer with every tab and keeps the toggle's badge on the console count. */
export function mountUi(context: DevtoolsContext): DrawerHandle {
  const drawer = mountDrawer(context, TABS);
  const { consoleCounter, raf } = context;
  const updateBadge = rafBatch(raf.request, () => drawer.setBadge(consoleCounter.total));
  consoleCounter.subscribe(updateBadge);
  drawer.setBadge(consoleCounter.total);
  return drawer;
}
