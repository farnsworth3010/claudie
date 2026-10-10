// How the overlay looks and behaves. The daemon keeps them and sends them with every snapshot,
// so every overlay looks the same; Ctrl+scroll on the Mac changes the size.
export interface Settings {
  readonly size: number; // screen points per art pixel
  readonly opacity: number;
  readonly overFullscreen: boolean; // stay visible over fullscreen windows instead of hiding
  readonly gaze: boolean; // eyes follow the pointer
  readonly antics: boolean; // clowning around when a dialog waits too long
  readonly neglect: boolean; // cobwebs, a flower, snow and bones when left idle for long
}

export type SettingsFlag = 'overFullscreen' | 'gaze' | 'antics' | 'neglect';
