import { PAL } from '../constants/look.ts';
import type { ArtRows, Bubble, HammerPhase, Side } from '../types.ts';

const { body: BODY, shade: SHADE, ink: INK, white: WHITE, red: RED, blue: BLUE, yellow: YELLOW, green: GREEN } = PAL;

// Letters of the pictures below; '.' is see-through.
export const ART_COLORS: Readonly<Record<string, number>> = {
  o: INK,
  w: WHITE,
  r: RED,
  b: BLUE,
  z: PAL.zed,
  y: YELLOW,
  g: GREEN,
  i: PAL.ice,
  p: PAL.cheek,
  n: PAL.brown,
  A: PAL.acc1,
  B: PAL.acc2,
  x: BODY,
  s: SHADE,
};

export const BUBBLES: Readonly<Record<Bubble, readonly string[]>> = {
  bang: ['.ooooo.', 'owwwwwo', 'owwrwwo', 'owwrwwo', 'owwrwwo', 'owwrwwo', 'owwwwwo', 'owwrwwo', '.ooooo.'],
  question: ['.ooooo.', 'owwwwwo', 'owbbbwo', 'owwwbwo', 'owwbbwo', 'owwbwwo', 'owwwwwo', 'owwbwwo', '.ooooo.'],
};
export const ZED: readonly string[] = ['zzzz', '..z.', '.z..', 'zzzz'];
export const ZED_SPOTS = [
  [14, 7],
  [16, 3],
  [12, 0],
] as const;
export const HEART: readonly string[] = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
// A small red cross by the head: a denied request.
export const CROSS: readonly string[] = ['r.r', '.r.', 'r.r'];
// A speech bubble with one to three dots, drawn over the right shoulder; its tail points at the speaker.
export const CHAT = (dots: number): readonly string[] => [
  '.ooooooo.',
  'owwwwwwwo',
  `ow${[0, 1, 2].map((i) => (i < dots ? 'o' : 'w')).join('w')}wo`,
  'owwwwwwwo',
  '.ooooooo.',
];
// Yellow parchment, held low: white paper with ink lines across the face reads as a toothy grin.
export const SCROLL = {
  held: [
    [1, 'nnn'],
    [2, 'yry'],
    [3, 'yry'],
    [4, 'nnn'],
  ],
  rolled: [
    [6, 'nyyyyyyn'],
    [7, 'nyyrryyn'],
  ],
  open: [
    [4, 'n........n'],
    [5, 'nyyyyyyyyn'],
    [6, 'nynnnynnyn'],
    [7, 'nyyyyyyyyn'],
    [8, 'nynnynnnyn'],
    [9, 'nyyyyyyyyn'],
    [10, 'n........n'],
  ],
} as const;
export const CUBE_COLORS: readonly number[] = [RED, BLUE, YELLOW, GREEN, WHITE];
// Held across the body: round body on the right, neck out past the left arm.
export const GUITAR = [
  [3, '..........nnn.'],
  [4, '.........nnnnn'],
  [5, 'onnnnnnnnnoonn'],
  [6, '.........nnnnn'],
  [7, '..........nnn.'],
] as const;
// A black double-cut electric with white pickups, slung low so the eyes stay clear, from column -1: the
// horns reach round a long white neck that runs out past the left arm to an ink headstock; a red knob
// and a cable to the floor.
export const ELECTRIC = [
  [4, '............oo......'],
  [5, 'ooo.........oooowowo'],
  [6, 'owwwwwwwwwwwwooowowo'],
  [7, '.............ooowowo'],
  [8, '............oooowowr'],
  [9, '............oo....oo'],
] as const;
// A yellow zig-zag spark.
export const BOLT: readonly string[] = ['..y', '.y.', 'yyy', '.y.', 'y..'];
export const NOTE: readonly string[] = ['.yy', '.y.', 'yy.', 'yy.'];
// Book and console sit low, below the eyes, so they don't read as glasses or a grin.
export const BOOK = [
  [5, '.wwww.wwww.'],
  [6, 'bwzzwowzzwb'],
  [7, 'bwwwwowwwwb'],
  [8, '.bbbbbbbbb.'],
] as const;
export const CONSOLE = [
  [5, 'oooooooo'],
  [6, 'oggggggo'],
  [7, 'oggggggo'],
  [8, 'owowwrro'],
] as const;
export const GUM_POP = [
  [6, 3],
  [11, 4],
  [7, 7],
  [12, 6],
  [9, 2],
] as const;
export const SPARKLES = [
  [0, -1],
  [16, 1],
  [2, -5],
  [15, -4],
  [8, -7],
  [18, 6],
] as const;
export const BALL_COLORS: readonly number[] = [RED, BLUE, YELLOW];
// Impact marks in grid coordinates, pinned to the wall while the body bounces off it:
// stars against side walls and the ceiling, dust on the floor.
export const IMPACT: Readonly<Record<Side, ReadonlyArray<readonly [number, number]>>> = {
  left: [
    [3, 13],
    [3, 18],
  ],
  right: [
    [16, 13],
    [16, 18],
  ],
  top: [
    [3, 1],
    [16, 1],
  ],
  bottom: [
    [1, 20],
    [18, 20],
  ],
};
export const PLUS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
export const SPINNER_COLORS: readonly number[] = [RED, BLUE, YELLOW];
export const TUMBLEWEED = [
  ['.nnn.', 'n.n.n', 'nn.nn', 'n.n.n', '.nnn.'],
  ['.nnn.', 'nn.nn', 'n.n.n', 'nn.nn', '.nnn.'],
] as const;
export const CLOCK: readonly string[] = ['.ooo.', 'owoyo', 'owooo', 'owwwo', '.ooo.'];
export const SPIDER: readonly string[] = ['o.o', '.o.', 'o.o'];
export const BUTTERFLY_PATH = [
  [15, -8],
  [17, -6],
  [16, -3],
  [13, -10],
  [9, -11],
  [5, -9],
  [3, -6],
  [6, -10],
] as const;
export const FLAKES = [
  [0, 0],
  [4, 7],
  [8, 3],
  [12, 10],
  [16, 5],
  [18, 12],
  [2, 14],
  [10, 16],
  [14, 1],
  [6, 11],
] as const;
// A long pointed beard hanging from the chin down between the legs.
export const BEARD = [
  [6, '..wwwwww..'],
  [7, '..wwwwww..'],
  [8, '...wwww...'],
  [9, '....ww....'],
] as const;
export const DIGITS = {
  6: ['.yy', 'y..', 'yyy', 'y.y', 'yyy'],
  7: ['yyy', '..y', '.y.', '.y.', '.y.'],
};
// Pop Cat: a round mouth that takes up the lower half of the face.
export const MOUTHS = {
  1: [
    [5, '...oooo...'],
    [6, '...orro...'],
    [7, '...oooo...'],
  ],
  2: [
    [3, '...oooo...'],
    [4, '..orrrro..'],
    [5, '..orrrro..'],
    [6, '..orrrro..'],
    [7, '...oooo...'],
  ],
} as const;
// Hammer in the right hand, [row, art] from column 14: raised over the shoulder, then struck
// head-down by the right foot with sparks, then resting there a moment.
export const HAMMER: Readonly<Record<HammerPhase, ArtRows>> = {
  up: [
    [-6, 'ooooo'],
    [-5, 'ooooo'],
    [-4, '..n..'],
    [-3, '..n..'],
    [-2, '..n..'],
    [-1, '..n..'],
    [0, '..n..'],
    [1, '..n..'],
  ],
  hit: [
    [3, 'y...y'],
    [6, '..n..'],
    [7, '.yn.y'],
    [8, '.ooo.'],
    [9, 'yooo.'],
  ],
  rest: [
    [6, '..n..'],
    [7, '..n..'],
    [8, '.ooo.'],
    [9, '.ooo.'],
  ],
};
// A round lens on a handle, [row, art] from its left column; 'i' is glass.
export const LENS: readonly string[] = ['.oooo.', 'oiiiio', 'oiiiio', 'oiiiio', 'oiiiio', '.oooo.'];
export const SHINE: ReadonlyArray<readonly [number, number]> = [
  [0, -2],
  [17, -1],
  [3, -6],
  [14, -7],
  [8, -9],
  [-1, 4],
  [18, 4],
  [9, -4],
];
// Seven rows of a world map, scrolled under the globe's disc as it spins.
export const WORLD: readonly string[] = [
  '...gg.....g.....',
  '..gggg...ggg.g..',
  '.ggggg..gggggg..',
  '..ggg....ggggg..',
  '...gg.....gg..g.',
  '...g.......g.ggg',
  '............gg..',
];
export const CONFETTI: ReadonlyArray<readonly [number, number]> = [
  [-1, -11],
  [2, -9],
  [5, -12],
  [8, -10],
  [11, -12],
  [14, -9],
  [17, -11],
  [0, -6],
  [16, -6],
  [4, -7],
  [13, -7],
  [9, -8],
];
export const CONFETTI_COLORS: readonly number[] = [RED, BLUE, YELLOW, GREEN, PAL.cheek, WHITE];
export const STORM = [
  [-7, '...zz.....'],
  [-6, '..zzzz.zz.'],
  [-5, '.zzzzzzzzz'],
  [-4, '..zzzzzzz.'],
] as const;
export const PANIC_DROPS = [
  [1, -1],
  [16, -2],
  [0, 2],
  [17, 1],
  [3, -3],
  [14, -3],
] as const;
export const CUP: readonly string[] = ['wnnw', 'wwwwo', 'wwww'];
// Slanted brows while stomping, and the cloud's lightning bolt.
export const STORM_BROWS = [
  [5, 0],
  [6, 1],
  [12, 0],
  [11, 1],
] as const;
export const LIGHTNING = [
  [9, -3],
  [8, -2],
  [9, -2],
  [8, -1],
] as const;
