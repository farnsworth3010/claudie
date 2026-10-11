import type { Skin, SkinId } from '../types.ts';

export const SKINS: Readonly<Record<SkinId, Skin>> = {
  helper: {
    body: '#f0a27e',
    acc: ['#3e63dd', '#e5484d'],
    accessory: [
      // propeller cap
      [-3, '.......oo.......'],
      [-2, '.....AAAAAA.....'],
      [-1, '....AAAAAAAA....'],
    ],
    spin: {
      // the blades turn: full width, foreshortened, edge-on, then back with the colours swapped
      row: -4,
      frames: [
        '.....yyyBBB.....',
        '......yyBB......',
        '.......yB.......',
        '......BByy......',
        '.....BBByyy.....',
        '......BByy......',
        '.......By.......',
        '......yyBB......',
      ],
    },
  },
  explorer: {
    body: '#8fa66b',
    acc: ['#d8c38e', '#6b4f2a'],
    accessory: [
      // safari hat
      [-4, '.....AAAAAA.....'],
      [-3, '....AAAAAAAA....'],
      [-2, '....BBBBBBBB....'],
      [-1, '.AAAAAAAAAAAAAA.'],
    ],
  },
  reviewer: {
    body: '#9b7bd8',
    acc: ['#e5484d', '#ffffff'],
    glasses: true,
    accessory: [
      // red-rimmed reading glasses; ink rims would swallow the eyes at mini size
      [1, '...AAA....AAA...'],
      [2, '...A.AAAAAA.A...'],
      [3, '...A.A....A.A...'],
      [4, '...AAA....AAA...'],
    ],
  },
  security: {
    body: '#8c96a3',
    acc: ['#c6cdd6', '#4a525c'],
    accessory: [
      // knight helmet with visor and plume
      [-4, '.......rr.......'],
      [-3, '.....AAAAAA.....'],
      [-2, '...AAAAAAAAAA...'],
      [-1, '..AAAAAAAAAAAA..'],
      [0, '..BBBBBBBBBBBB..'],
      [1, '..BBBBBBBBBBBB..'],
    ],
  },
  planner: {
    body: '#4f7bc4',
    acc: ['#f5c542', '#c9971c'],
    accessory: [
      // hard hat
      [-4, '......AAAA......'],
      [-3, '....AAABBAAA....'],
      [-2, '...AAAABBAAAA...'],
      [-1, '.AAAAAAAAAAAAAA.'],
    ],
  },
  tester: {
    body: '#3bb3a6',
    acc: ['#bfe8ff', '#2b3a42'],
    glasses: true,
    accessory: [
      // safety goggles on a strap
      [1, '...AAA....AAA...'],
      [2, '..BA.ABBBBA.AB..'],
      [3, '...A.A....A.A...'],
      [4, '...AAA....AAA...'],
    ],
  },
  debugger: {
    body: '#a9774e',
    acc: ['#d8b48a', '#6e4a2c'],
    accessory: [
      // deerstalker
      [-4, '.....ABABAB.....'],
      [-3, '....BABABABA....'],
      [-2, '...ABABABABAB...'],
      [-1, '.AAABABABABAAA..'],
    ],
  },
  writer: {
    body: '#eadbc0',
    acc: ['#8a3a4a', '#f5c542'],
    accessory: [
      // beret with a pencil behind the ear
      [-4, '.......o.......o'],
      [-3, '....AAAAAAA...B.'],
      [-2, '...AAAAAAAAAAB..'],
      [-1, '....AAAAAAAA....'],
    ],
  },
  designer: {
    body: '#f28db2',
    acc: ['#8e44ad', '#ffffff'],
    accessory: [
      // floppy beret and paint splashes
      [-3, '.....AAAAAA.....'],
      [-2, '...AAAAAAAAAAA..'],
      [-1, '..AAAAAAAAA.....'],
      [6, '....r..y..b.....'],
    ],
  },
  executor: {
    body: '#e8613a',
    acc: ['#2f6fde', '#1e4fa8'],
    accessory: [
      // cap worn backwards
      [-2, '.....AAAAAAA....'],
      [-1, 'BBBBAAAAAAAAA...'],
    ],
  },
  refactorer: {
    body: '#d9b44a',
    acc: ['#2f6f6a', '#c6cdd6'],
    accessory: [
      // headband with a wrench tucked in on the right
      [-4, '..........B.B...'],
      [-3, '..........BBB...'],
      [-2, '..AAAAAAAAABAA..'],
      [-1, '..AAAAAAAAABAA..'],
    ],
  },
};

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];
