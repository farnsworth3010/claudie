import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import type { Rect, Screen } from '@claudie/core/scene/types.ts';
import { area, contains } from '../lib/screens.ts';

// The monitors in stage coordinates, which are the scene's: logical pixels, top-left origin. The
// index is the id, so a saved anchor finds its monitor again after a restart.
export function screens(overDock: boolean, overMenuBar: boolean): Screen[] {
  return Main.layoutManager.monitors.map((monitor, index) => {
    const work = Main.layoutManager.getWorkAreaForMonitor(index);
    const bounds = { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height };
    const room = { x: work.x, y: work.y, width: work.width, height: work.height };
    return { id: index, area: area(bounds, room, overDock, overMenuBar) };
  });
}

// The monitor a point is on, for keeping the tooltip inside it.
export function monitorAt(x: number, y: number): Rect | null {
  const monitor = Main.layoutManager.monitors.find((m) => contains(m, x, y)) ?? Main.layoutManager.primaryMonitor;
  return monitor ? { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height } : null;
}
