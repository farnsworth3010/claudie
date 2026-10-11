import {
  ATTACK_SAMPLES,
  CHIRP_NOTES,
  DECAY,
  SAMPLE_RATE,
  VIBRATO_DEPTH,
  VIBRATO_HZ,
  VIBRATO_MIN_NOTE_S,
  VOLUME,
} from '../constants/sound.ts';

// A square-wave arpeggio, each note dying away after a click-free attack.
function chirpSamples(): number[] {
  const samples: number[] = [];
  for (const [freq, seconds] of CHIRP_NOTES) {
    const n = Math.round(seconds * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const vibrato = seconds > VIBRATO_MIN_NOTE_S ? 1 + VIBRATO_DEPTH * Math.sin(2 * Math.PI * VIBRATO_HZ * t) : 1;
      const square = (freq * vibrato * t) % 1 < 0.5 ? 1 : -1;
      const envelope = Math.min(1, i / ATTACK_SAMPLES) * Math.exp((-DECAY * i) / n);
      samples.push(square * envelope * VOLUME);
    }
  }
  return samples;
}

// 16-bit mono PCM WAV.
function encodeWav(samples: readonly number[]): Uint8Array {
  const dataLength = samples.length * 2;
  const wav = new Uint8Array(44 + dataLength);
  const view = new DataView(wav.buffer);
  const tag = (at: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  tag(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  tag(36, 'data');
  view.setUint32(40, dataLength, true);
  samples.forEach((v, i) => {
    view.setInt16(44 + i * 2, Math.round(v * 32_767), true);
  });
  return wav;
}

// An 8-bit "power-up" chirp for a Clawd clicked three times, synthesised on the fly so no audio
// file has to ship.
export function chirpWav(): Uint8Array {
  return encodeWav(chirpSamples());
}
