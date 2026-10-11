import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chirpWav } from '../../../src/scene/sound/chirp.ts';

test('the chirp is a 16-bit mono WAV of about a third of a second', () => {
  const wav = chirpWav();
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const text = (at: number, n: number) => String.fromCharCode(...wav.subarray(at, at + n));
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 8), 'WAVEfmt ');
  assert.equal(text(36, 4), 'data');
  assert.equal(view.getUint32(4, true), wav.length - 8);
  assert.equal(view.getUint32(40, true), wav.length - 44);
  assert.equal(view.getUint16(20, true), 1, 'PCM');
  assert.equal(view.getUint16(22, true), 1, 'mono');
  assert.equal(view.getUint16(34, true), 16, 'bits');
  const rate = view.getUint32(24, true);
  const seconds = (wav.length - 44) / 2 / rate;
  assert.ok(seconds > 0.3 && seconds < 0.5, `${seconds} s`);
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
  assert.ok(peak > 1000 && peak < 32_767 * 0.3, `peak ${peak}`);
});
