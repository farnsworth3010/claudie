import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { chirpWav } from '@claudie/core/scene/sound/chirp.ts';

// The shell's sound player only plays files, so the chirp is written to the cache once.
export class Chirp {
  private file: Gio.File | null = null;

  play(): void {
    const file = this.file ?? this.write();
    if (file) global.display.get_sound_player().play_from_file(file, 'Claudie', null);
  }

  private write(): Gio.File | null {
    const dir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'claudie']);
    try {
      GLib.mkdir_with_parents(dir, 0o755);
      const file = Gio.File.new_for_path(GLib.build_filenamev([dir, 'chirp.wav']));
      file.replace_contents(chirpWav(), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
      this.file = file;
      return file;
    } catch (error) {
      console.warn(`Claudie: could not write the chirp: ${error}`);
      return null;
    }
  }
}
