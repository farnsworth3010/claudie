export const SAMPLE_RATE = 22_050;
export const VOLUME = 0.22;

// [frequency in Hz, seconds]: A5 C#6 E6 A6.
export const CHIRP_NOTES: ReadonlyArray<readonly [number, number]> = [
  [880, 0.06],
  [1109, 0.06],
  [1319, 0.06],
  [1760, 0.16],
];

export const ATTACK_SAMPLES = 60; // fade-in length that keeps the start of a note from clicking
export const DECAY = 3; // how fast a note dies away: e^-DECAY by its end
export const VIBRATO_HZ = 9;
export const VIBRATO_DEPTH = 0.01;
export const VIBRATO_MIN_NOTE_S = 0.1; // only notes longer than this get vibrato
