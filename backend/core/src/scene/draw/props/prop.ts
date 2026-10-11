import type { Prop, Setter } from '../../types.ts';
import { paintBits, paintConfetti, paintDizzy, paintPanic, paintScroll, paintShine, paintStorm } from './effects.ts';
import {
  paintBalls,
  paintBook,
  paintCube,
  paintCup,
  paintDigits,
  paintElectric,
  paintGame,
  paintGuitar,
  paintGum,
  paintSparkles,
  paintSpinner,
  paintYoyo,
} from './fidget.ts';
import { paintElder, paintGarden, paintSnow, paintSpider, paintTumbleweed } from './neglect.ts';
import { paintGlobe, paintHammer, paintKeys, paintLens } from './tools.ts';

// Props are told apart by the one field that names them; each kind has its own painter.
export function drawProp(prop: Prop, set: Setter): void {
  if ('cube' in prop) paintCube(set, prop.cube);
  else if ('guitar' in prop) paintGuitar(set, prop.guitar);
  else if ('electric' in prop) paintElectric(set, prop.electric);
  else if ('book' in prop) paintBook(set, prop.book);
  else if ('gum' in prop) paintGum(set, prop.gum);
  else if ('yoyo' in prop) paintYoyo(set, prop.yoyo);
  else if ('game' in prop) paintGame(set, prop.game);
  else if ('sparkle' in prop) paintSparkles(set, prop.sparkle);
  else if ('dizzy' in prop) paintDizzy(set, prop.dizzy);
  else if ('spinner' in prop) paintSpinner(set, prop.spinner);
  else if ('digits' in prop) paintDigits(set, prop.digits);
  else if ('tumbleweed' in prop) paintTumbleweed(set, prop.tumbleweed);
  else if ('elder' in prop) paintElder(set, prop.elder);
  else if ('spider' in prop) paintSpider(set, prop.spider);
  else if ('garden' in prop) paintGarden(set, prop.garden, prop.grow);
  else if ('snow' in prop) paintSnow(set, prop.snow);
  else if ('panic' in prop) paintPanic(set, prop.panic);
  else if ('keys' in prop) paintKeys(set, prop.keys);
  else if ('hammer' in prop) paintHammer(set, prop.hammer);
  else if ('lens' in prop) paintLens(set, prop.lens, prop.big);
  else if ('globe' in prop) paintGlobe(set, prop.globe);
  else if ('confetti' in prop) paintConfetti(set, prop.confetti);
  else if ('storm' in prop) paintStorm(set, prop.storm);
  else if ('bits' in prop) paintBits(set, prop.bits);
  else if ('shine' in prop) paintShine(set, prop.shine);
  else if ('scroll' in prop) paintScroll(set, prop.scroll);
  else if ('balls' in prop) paintBalls(set, prop.balls);
  else paintCup(set, prop.cup, prop.steam);
}
