import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type { Anchor } from '@claudie/core/scene/types.ts';

// Where the crew last settled, so it comes back there after a restart or a new login.
const DIR = () => GLib.build_filenamev([GLib.get_user_state_dir(), 'claudie']);

function file(): Gio.File {
  return Gio.File.new_for_path(GLib.build_filenamev([DIR(), 'gnome.json']));
}

export function loadAnchor(): Anchor | null {
  try {
    const [, bytes] = file().load_contents(null);
    return (JSON.parse(new TextDecoder().decode(bytes)) as { anchor?: Anchor }).anchor ?? null;
  } catch {
    return null; // none saved yet, or unreadable: start where the stage puts a new crew
  }
}

export function saveAnchor(anchor: Anchor): void {
  try {
    GLib.mkdir_with_parents(DIR(), 0o755);
    const bytes = new TextEncoder().encode(JSON.stringify({ anchor }));
    file().replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
  } catch (error) {
    console.warn(`Claudie: could not save the position: ${error}`);
  }
}
