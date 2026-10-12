import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import { DEFAULT_PORT } from '../lib/constants.ts';

// The daemon on this machine, or the one a `ssh -L` forward brings here.
export function baseUrl(): string {
  return `http://127.0.0.1:${GLib.getenv('CLAUDIE_PORT') || DEFAULT_PORT}`;
}

export function openSettingsPage(): void {
  Gio.AppInfo.launch_default_for_uri(`${baseUrl()}/`, null);
}

// The daemon refuses a POST without a JSON content type.
export function postSettings(session: Soup.Session, patch: unknown, cancellable: Gio.Cancellable): void {
  const message = Soup.Message.new('POST', `${baseUrl()}/settings`);
  if (!message) return;
  const body = new TextEncoder().encode(JSON.stringify(patch));
  message.set_request_body_from_bytes('application/json', new GLib.Bytes(body));
  session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, cancellable, (_session, result) => {
    try {
      session.send_and_read_finish(result);
    } catch (error) {
      if (!cancellable.is_cancelled()) console.warn(`Claudie: could not save settings: ${error}`);
    }
  });
}
