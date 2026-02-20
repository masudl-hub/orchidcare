import React, { useEffect, useRef } from 'react';

// --- CONFIG ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const SCALE = 6;

// --- GENERATOR DATA ---
const CATEGORIES = [
  'SURPRISE ME', 'CACTUS', 'FERN', 'FLOWER', 'FUNGUS',
  'VINE', 'SUCCULENT', 'AQUATIC', 'CARNIVORE', 'ALIEN', 'BONSAI',
];

const PREFIXES = [
  'VELVET', 'GHOST', 'DANCING', 'SCREAMING', 'CHUNKY', 'SPICY',
  'ROYAL', 'DRAMATIC', 'STINKY', 'SAD', 'HAPPY', 'CRYSTAL',
  'TOXIC', 'SAVAGE', 'FERAL', 'WEEPING', 'ITCHY', 'FUZZY',
  'COSMIC', 'GRUMPY', 'ANCIENT', 'GLITCHING', 'NEON', 'RUSTY',
  'BLESSED', 'CURSED', 'VAMPIRIC', 'CELESTIAL', 'DEMONIC', 'SLEEPY',
  'ANXIOUS', 'GIGANTIC', 'MICROSCOPIC', 'RADIOACTIVE', 'FORGOTTEN',
  'SACRED', 'PROFANE', 'WOBBLY', 'PRICKLY', 'SLIMY', 'DUSTY',
  'MAJESTIC', 'DERPY', 'ELDRITCH', 'CYBER', 'STEAMPUNK', 'INVISIBLE',
  'HYPNOTIC', 'GLITTERING', 'OMINOUS', 'PETTY', 'JUDGMENTAL', 'FIERY',
  'FROZEN', 'SHY', 'OVERCONFIDENT', 'LOUD', 'WHISPERING', 'CREEPING',
  'JEALOUS', 'MELANCHOLY', 'PHILOSOPHICAL', 'NEUROTIC', 'ZEN',
];

const ROOTS_BY_CATEGORY: Record<string, string[]> = {
  'CACTUS': ['CACTUS', 'PRICKLE', 'SPIKE', 'BARREL', 'NEEDLE', 'POKER', 'SAGUARO', 'PINCUSHION', 'CHOLLA', 'THORN', 'BRISTLE'],
  'FERN': ['FERN', 'FROND', 'BRACKEN', 'BUSH', 'SHRUB', 'FIDDLEHEAD', 'SPORE-LEAF', 'CANOPY', 'MAIDENHAIR'],
  'FLOWER': ['BLOOM', 'PETAL', 'LILY', 'ORCHID', 'WEED', 'DAISY', 'ROSE', 'TULIP', 'BLOSSOM', 'SUNFLOWER', 'BUD', 'COROLLA'],
  'FUNGUS': ['SHROOM', 'SPORE', 'FUNGUS', 'CAP', 'TOADSTOOL', 'PUFFBALL', 'TRUFFLE', 'MYCELIUM', 'MOLD', 'YEAST', 'CHANTERELLE'],
  'VINE': ['VINE', 'CREEPER', 'STRANGLER', 'IVY', 'BRAMBLE', 'TANGLE', 'SNARE', 'KNOT', 'LIANA', 'TENDRIL', 'CLIMBER'],
  'SUCCULENT': ['ALOE', 'JADE', 'LITHOPS', 'PEBBLE', 'STONE-CROP', 'AGAVE', 'ROSETTE', 'PLUMP-LEAF', 'FAT-PLANT', 'ECHEVERIA'],
  'AQUATIC': ['KELP', 'ALGAE', 'LILYPAD', 'SEAGRASS', 'MOSS', 'WEED', 'POND-SCUM', 'WATER-STAR', 'CORAL', 'REED'],
  'CARNIVORE': ['FLYTRAP', 'SUNDEW', 'PITCHER', 'SNAPPER', 'GULPER', 'TRAP', 'MAW', 'JAW', 'DEVOURER', 'BLADDERWORT'],
  'ALIEN': ['ORB', 'TENTACLE', 'GLOW-BULB', 'VOID-POD', 'PULSE-WEED', 'NEBULA-SPROUT', 'ASTRAL-ROOT', 'MUTANT', 'XENO-FLORA'],
  'BONSAI': ['PINE', 'WILLOW', 'OAK', 'BANYAN', 'MAPLE', 'TREE', 'SAPLING', 'ROOT-OVER-ROCK', 'TIMBER', 'JUNIPER'],
};

const SUFFIXES = [
  'OF DOOM', 'THE EATER', 'CREEPER', 'BLIGHT', 'WHISPERER',
  'BANE', 'BOY', 'GIRL', 'TERROR', 'DELIGHT', 'WEEPER', 'MUNCHER', 'DESTROYER',
  'THE ANCIENT', 'OF THE VOID', 'CHASER', 'GUARDIAN', 'THE OMNIPOTENT',
  'SLAYER', 'CONSUMER', 'OF THE ABYSS', 'THE FORSAKEN', 'THE COWARD',
  'OVERLORD', 'THE GOOFBALL', 'MASTER', 'APPRENTICE', 'THE UNTOUCHABLE',
  'BRINGER OF TEARS', 'THE ITCH', 'OF THE STARS', 'THE WATCHER',
  'THE FORGOTTEN', 'OF BABYLON', 'THE LOUD', 'THE DISAPPOINTMENT',
  'OF THE REALM', 'THE GLORIOUS', 'THE STINKY', 'OF SECRETS', 'THE BLESSED',
];

const SINGLE_NAMES = [
  'BOB', 'GREG', 'CHONK', 'SPIKESTER', 'PRICKLES', 'GLOOM',
  'AUDREY', 'MORTIMER', 'BARTHOLOMEW', 'SQUISHY', 'TANGLES', 'THE INTRUDER', 'STEVE',
  'CORNELIUS', 'BLOB', 'SPROUT', 'GRIM', 'FLUFFY', 'BEHEMOTH', 'PENELOPE',
  'GORGON', 'KEVIN', 'SUSAN', 'DOZER', 'SNUGGLEBITE', 'SCRATCHY', 'LURKER',
  'NODULE', 'LUMP', 'FIGMENT', 'BARNABY', 'WILBUR', 'TATER', 'MEATBALL',
  'THE ENTITY', 'REGINALD', 'GERTRUDE', 'SPUD', 'GOLIATH', 'BITE-SIZED',
];

const QUIRKS = [
  'SCREAMS WHEN WATERED', 'THINKS IT IS A DOG', 'OWES ME $5',
  'PREFERS JAZZ OVER CLASSICAL', 'BITES (A LOT)', 'VERY POLITE',
  'SECRETLY A PLASTIC PLANT', 'AFRAID OF THE DARK', 'PHOTOSYNTHESIZES IRONICALLY',
  'JUDGES YOUR OUTFIT', 'LEAVES READ "SEND HELP"', 'EATS FLIES, AND CHEETOS',
  'NEEDS CONSTANT VALIDATION', 'SHIVERS IN THE BREEZE', 'HATES MONDAYS',
  'ONLY DRINKS SPARKLING WATER', 'DRAMATICALLY DROOPS FOR ATTENTION',
  'IS PLANNING A HEIST', 'KNOWS WHAT YOU DID', 'ALLERGIC TO DUST',
  'REINCARNATED VICTORIAN GHOST', 'EATS SPARE CHANGE', 'GLOWS IN THE PRESENCE OF WIFI',
  'WILL OUTLIVE YOU', 'JUDGES YOUR BROWSER HISTORY', 'SNEEZES IN PRIMES',
  'HATES THE COLOR RED', 'FLIRTS WITH THE LAMP', 'SECRETLY CRYPTO MINING',
  'STEALS YOUR SOCKS', 'CAN TASTE TIME', 'REFUSES TO GROW ON TUESDAYS',
  'COMMUNICATES VIA MORSE CODE', 'DEMANDS SACRIFICE', 'ALLERGIC TO ITSELF',
  'THINKS IT IS A TOMATO', 'SINGS OFF-KEY LULLABIES', 'PLOTTING REVENGE',
  'WANTS TO SPEAK TO THE MANAGER', 'VOTED MOST LIKELY TO SUCCEED',
  'AVOIDS EYE CONTACT', 'ALWAYS HAS A COLD', 'PRAISES THE SUN',
  'IS 90% WATER AND 10% SPITE', 'HAS A PHD IN BOTANY', 'FEARS THE SCISSORS',
  'PRETENDS TO BE DEAD', 'LOVES GOSSIP', 'KEEPS ASKING FOR WIFI PASSWORD',
  'BELIEVES IN ALIENS', 'HAS A PODCAST', 'WRITES TERRIBLE POETRY',
  'IS CURRENTLY UNIONIZING', 'DEMANDS A WINDOW SEAT',
];

const generateName = (category: string) => {
  if (Math.random() < 0.15) {
    return SINGLE_NAMES[Math.floor(Math.random() * SINGLE_NAMES.length)];
  }
  const pre = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const actualCategory = category === 'SURPRISE ME'
    ? CATEGORIES[Math.floor(Math.random() * (CATEGORIES.length - 1)) + 1]
    : category;
  const roots = ROOTS_BY_CATEGORY[actualCategory];
  const root = roots[Math.floor(Math.random() * roots.length)];

  if (Math.random() > 0.6) {
    const suf = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    return `${pre} ${root} ${suf}`;
  }
  return `${pre} ${root}`;
};

const generateQuirk = () => `* ${QUIRKS[Math.floor(Math.random() * QUIRKS.length)]} *`;

const getRandomChar = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*?";
  return chars[Math.floor(Math.random() * chars.length)];
};

// --- SPRITES (20x20 max) ---
const SPRITES_POTS = [
  [
    "      11111111      ",
    "      11111111      ",
    "     1111111111     ",
    "     1        1     ",
    "     1   11   1     ",
    "     1111111111     ",
    "      11111111      ",
    "       111111       ",
  ],
  [
    "      11111111      ",
    "     1111111111     ",
    "     1 1 1 1 11     ",
    "     11 1 1 1 1     ",
    "     1 1 1 1 11     ",
    "     11 1 1 1 1     ",
    "      11111111      ",
    "      11111111      ",
  ],
  [
    "       111111       ",
    "      11111111      ",
    "      1      1      ",
    "      1      1      ",
    "      1      1      ",
    "      1      1      ",
    "      11111111      ",
    "      11111111      ",
  ],
  [
    "      11111111      ",
    "     11111111111    ",
    "     1        1 1   ",
    "     1  1  1  1 1   ",
    "     1   11   1 1   ",
    "     11111111111    ",
    "      11111111      ",
    "      11111111      ",
  ],
  [
    "      11111111      ",
    "      111 1111      ",
    "     1111 111111    ",
    "     1    1   1     ",
    "     1  1 1   1     ",
    "     111 111111     ",
    "      11111111      ",
    "       111111       ",
  ],
  [
    "      11111111      ",
    "     1        1     ",
    "    1          1    ",
    "    1    11    1    ",
    "    1   1  1   1    ",
    "     1        1     ",
    "      11111111      ",
    "        1111        ",
  ],
  [
    "                    ",
    "                    ",
    "                    ",
    "   11111111111111   ",
    "   1            1   ",
    "    11        11    ",
    "      11111111      ",
    "        1111        ",
  ],
  [
    "                    ",
    "      11111111      ",
    "     1111111111     ",
    "      1      1      ",
    "        1111        ",
    "       1    1       ",
    "                    ",
    "        1111        ",
  ],
];

const SPRITES_BY_CATEGORY: Record<string, string[][]> = {
  'CACTUS': [
    [
      "                    ",
      "       1111         ",
      "      11  11        ",
      "     11    11       ",
      "     11    11  11   ",
      "   1111    11 11    ",
      "  11 11    1111     ",
      "  11 11    11       ",
      "   1111    11       ",
      "     11    11       ",
      "     11111111       ",
    ],
    [
      "                    ",
      "        1111        ",
      "      11111111      ",
      "     11  11  11     ",
      "    11   11   11    ",
      "    11   11   11    ",
      "    11   11   11    ",
      "     11  11  11     ",
      "      11111111      ",
      "        1111        ",
    ],
    [
      "                    ",
      "                    ",
      "                    ",
      "     11             ",
      "    1111  11   11   ",
      "    1111 1111 1111  ",
      "    1111 1111 1111  ",
      "    1111 1111 1111  ",
      "    1111 1111 1111  ",
      "     11   11   11   ",
      "    11111111111111  ",
    ],
    [
      "        1111        ",
      "       11  11       ",
      "       11  11       ",
      "      11    11      ",
      "     11     11      ",
      "     11    11       ",
      "      11  11        ",
      "       11  11       ",
      "      11    11      ",
      "      11   11       ",
      "       11111        ",
    ],
  ],
  'FLOWER': [
    [
      "        11          ",
      "       1111         ",
      "      1    1        ",
      "   11 1 11 1 11     ",
      "  1  11 11 11  1    ",
      "  1            1    ",
      "   11        11     ",
      "     11    11       ",
      "       1111         ",
      "        11          ",
      "       1111         ",
      "      111111        ",
    ],
    [
      "         11         ",
      "       11  11       ",
      "      1      1      ",
      "     1   11   1     ",
      "    1   1111   1    ",
      "     1   11   1     ",
      "      1      1      ",
      "       11  11       ",
      "         11         ",
      "         11         ",
      "       111111       ",
    ],
    [
      "                    ",
      "        1111        ",
      "       11  11       ",
      "      11 11 11      ",
      "      11 11 11      ",
      "      11 11 11      ",
      "       111111       ",
      "         11         ",
      "         11  11     ",
      "       1 11 1       ",
      "        1111        ",
    ],
    [
      "        1111        ",
      "      11    11      ",
      "     1  1111  1     ",
      "    1  1    1  1    ",
      "    1  1 11 1  1    ",
      "    1  1    1  1    ",
      "     1  1111  1     ",
      "      11    11      ",
      "        1111        ",
      "         11         ",
      "        1111        ",
    ],
  ],
  'FERN': [
    [
      "        11          ",
      "       1  1         ",
      "      1   1         ",
      "     1   1 1        ",
      "    1   1  111      ",
      "   1   1     11     ",
      "       1      1     ",
      "  11   1      1     ",
      " 1  1  1     1      ",
      " 1   1 1    1       ",
      "      111111        ",
    ],
    [
      "                    ",
      "     111            ",
      "    1   1   111     ",
      "    1 1 1  1   1    ",
      "    1  11  1 1 1    ",
      "     111   1  11    ",
      "       1    111     ",
      "       1     1      ",
      "       11   11      ",
      "        11 11       ",
      "         111        ",
    ],
    [
      "         11         ",
      "       11  11       ",
      "      1      1      ",
      "     11      11     ",
      "       11  11       ",
      "     11      11     ",
      "    1          1    ",
      "      11    11      ",
      "    11   11   11    ",
      "         11         ",
      "        1111        ",
    ],
  ],
  'FUNGUS': [
    [
      "                    ",
      "                    ",
      "       11111        ",
      "     111   111      ",
      "    11       11     ",
      "   11  11     11    ",
      "  111111111111111   ",
      "       1111         ",
      "       1111         ",
      "       1111         ",
      "       1111         ",
    ],
    [
      "             11     ",
      "           11111    ",
      "     111  1111111   ",
      "   111111   111     ",
      "  11111111  111     ",
      "    111     111     ",
      "    111   1111111   ",
      "    111  111111111  ",
      "  111111    111     ",
      "    111     111     ",
      "    111     111     ",
    ],
    [
      "                    ",
      "                    ",
      "                    ",
      "    1111111111      ",
      "  111        111    ",
      "  11111111111111    ",
      "       1111         ",
      "       1111         ",
      "       1111         ",
      "       1111         ",
      "       1111         ",
    ],
    [
      "         11         ",
      "        1  1        ",
      "       1    1       ",
      "      1      1      ",
      "       111111       ",
      "         11         ",
      "         11         ",
      "       1 11         ",
      "         11         ",
      "         11 1       ",
      "        1111        ",
    ],
  ],
  'VINE': [
    [
      "    11      11      ",
      "   1  1    1  1     ",
      "   1  1    1  1     ",
      "    11      11      ",
      "    11      11      ",
      "     11    11       ",
      "      11  11        ",
      "      11  11        ",
      "      11  11        ",
      "      11  11        ",
      "     11111111       ",
    ],
    [
      "                    ",
      "         11         ",
      "       11111   11   ",
      "        111  11111  ",
      "      11111    111  ",
      "    11111     111   ",
      "      11    1111    ",
      "       1111111      ",
      "         11         ",
      "         11         ",
      "       111111       ",
    ],
    [
      "     11      11     ",
      "    1  1    1  1    ",
      "   1   111111   1   ",
      "   1 11      11 1   ",
      "   11  11  11  11   ",
      "    111      111    ",
      "      11    11      ",
      "     1  1  1  1     ",
      "     1  1111  1     ",
      "      11    11      ",
      "       111111       ",
    ],
  ],
  'SUCCULENT': [
    [
      "         11         ",
      "        1111        ",
      "   11   1111   11   ",
      "  1111  1111  1111  ",
      "  1111  1111  1111  ",
      "   1111 1111 1111   ",
      "    111111111111    ",
      "     1111111111     ",
      "      11111111      ",
      "       111111       ",
      "        1111        ",
    ],
    [
      "                    ",
      "                    ",
      "                    ",
      "                    ",
      "      111  111      ",
      "     1111  1111     ",
      "    11111  11111    ",
      "    11111  11111    ",
      "    11111  11111    ",
      "     1111111111     ",
      "      11111111      ",
    ],
    [
      "                    ",
      "                    ",
      "        1111        ",
      "     1111111111     ",
      "    111      111    ",
      "   111  1111  111   ",
      "  111  111111  111  ",
      "   111  1111  111   ",
      "    111      111    ",
      "     1111111111     ",
      "      11111111      ",
    ],
  ],
  'AQUATIC': [
    [
      "                    ",
      "                    ",
      "                    ",
      "                    ",
      "                    ",
      "    1111    1111    ",
      "  1111111  1111111  ",
      " 11111111111111111  ",
      " 11111111111111111  ",
      "  111111111111111   ",
      "    11111111111     ",
    ],
    [
      "      11            ",
      "      11   11       ",
      "     11   11        ",
      "     11   11   11   ",
      "    11   11   11    ",
      "    11   11   11    ",
      "   11   11   11     ",
      "   11   11   11     ",
      "   11  11   11      ",
      "   11  11   11      ",
      "   11111111111      ",
    ],
  ],
  'CARNIVORE': [
    [
      "         11         ",
      "        1111        ",
      "       11  11       ",
      "       111111       ",
      "       11  11       ",
      "      11    11      ",
      "      11    11      ",
      "      11    11      ",
      "       11  11       ",
      "        1111        ",
      "         11         ",
    ],
    [
      "   11          11   ",
      "   1 1        1 1   ",
      "   1  1      1  1   ",
      "    1  1    1  1    ",
      "    11 11  11 11    ",
      "     1111111111     ",
      "      11111111      ",
      "         11         ",
      "       1111         ",
      "      11  11        ",
      "     11    11       ",
    ],
  ],
  'ALIEN': [
    [
      "                    ",
      "      11111111      ",
      "     1  1   1 1     ",
      "    1 1   1  1 1    ",
      "   1   1 1 1  1 1   ",
      "   1 1  1   1   1   ",
      "   1  1  1 1  1 1   ",
      "    1   1   1  1    ",
      "     1 1  1  11     ",
      "      11111111      ",
      "        1111        ",
    ],
    [
      "         11         ",
      "        1111        ",
      "      111  111      ",
      "     11      11     ",
      "     11  11  11     ",
      "     11  11  11     ",
      "      11 11 11      ",
      "       111111       ",
      "         11         ",
      "       111111       ",
      "      11    11      ",
    ],
  ],
  'BONSAI': [
    [
      "                    ",
      "          1111111   ",
      "        1111111111  ",
      "       1111111111   ",
      "            111     ",
      "      11111111      ",
      "     1111111        ",
      "         111        ",
      "        111         ",
      "      1111          ",
      "     11111111       ",
    ],
    [
      "         11         ",
      "       111111       ",
      "     1111111111     ",
      "      11111111      ",
      "   11111 11 11111   ",
      "  111111 11 111111  ",
      "   1111  11  1111   ",
      "         11         ",
      "      11111111      ",
      "      111  111      ",
      "     1111111111     ",
    ],
  ],
};

const ALL_SPRITES = Object.values(SPRITES_BY_CATEGORY).flat();

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    frame: 0,
    mouseX: 0,
    mouseY: 0,
    particles: [] as Particle[],
    currentName: "SQUISHY",
    targetName: "SQUISHY",
    currentQuirk: "* LIKES TO BE IGNORED *",
    targetQuirk: "* LIKES TO BE IGNORED *",
    scrambleTimer: 0,
    plantIndex: 0,
    potIndex: 0,
    currentCategory: 'SURPRISE ME',
    hoverBtn: false,
    hoverLeft: false,
    hoverRight: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    stateRef.current.plantIndex = Math.floor(Math.random() * ALL_SPRITES.length);
    stateRef.current.potIndex = Math.floor(Math.random() * SPRITES_POTS.length);
    stateRef.current.targetQuirk = generateQuirk();
    stateRef.current.currentQuirk = stateRef.current.targetQuirk;

    const handleMouseMove = (e: MouseEvent) => {
      const s = stateRef.current;
      const rect = canvas.getBoundingClientRect();
      s.mouseX = e.clientX - rect.left;
      s.mouseY = e.clientY - rect.top;

      const btnW = 340;
      const btnH = 50;
      const btnX = CANVAS_WIDTH / 2 - btnW / 2;
      const btnY = CANVAS_HEIGHT - 75;
      s.hoverBtn = (s.mouseX >= btnX && s.mouseX <= btnX + btnW && s.mouseY >= btnY && s.mouseY <= btnY + btnH);

      const arrowY = CANVAS_HEIGHT - 135;
      s.hoverLeft = (s.mouseX >= CANVAS_WIDTH / 2 - 140 && s.mouseX <= CANVAS_WIDTH / 2 - 100 && s.mouseY >= arrowY && s.mouseY <= arrowY + 30);
      s.hoverRight = (s.mouseX >= CANVAS_WIDTH / 2 + 100 && s.mouseX <= CANVAS_WIDTH / 2 + 140 && s.mouseY >= arrowY && s.mouseY <= arrowY + 30);

      canvas.style.cursor = (s.hoverBtn || s.hoverLeft || s.hoverRight) ? 'pointer' : 'default';
    };

    const handleMouseDown = (_e: MouseEvent | TouchEvent) => {
      const s = stateRef.current;
      if (s.scrambleTimer > 0) return;

      if (s.hoverBtn) {
        triggerGeneration(s.currentCategory);
      } else if (s.hoverLeft) {
        changeCategory(-1);
      } else if (s.hoverRight) {
        changeCategory(1);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.scrambleTimer > 0) return;

      if (e.code === 'ArrowLeft') {
        changeCategory(-1);
      } else if (e.code === 'ArrowRight') {
        changeCategory(1);
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        triggerGeneration(s.currentCategory);
      }
    };

    const changeCategory = (dir: number) => {
      const s = stateRef.current;
      let idx = CATEGORIES.indexOf(s.currentCategory) + dir;
      if (idx < 0) idx = CATEGORIES.length - 1;
      if (idx >= CATEGORIES.length) idx = 0;
      s.currentCategory = CATEGORIES[idx];
      triggerGeneration(s.currentCategory);
    };

    const triggerGeneration = (category: string) => {
      const s = stateRef.current;
      s.targetName = generateName(category);
      s.targetQuirk = generateQuirk();
      s.scrambleTimer = 25;

      if (category === 'SURPRISE ME') {
        s.plantIndex = Math.floor(Math.random() * ALL_SPRITES.length);
      } else {
        const categorySprites = SPRITES_BY_CATEGORY[category];
        s.plantIndex = Math.floor(Math.random() * categorySprites.length);
      }

      s.potIndex = Math.floor(Math.random() * SPRITES_POTS.length);

      for (let i = 0; i < 30; i++) {
        s.particles.push({
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2 - 20,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 0.5) * 14,
          life: 15 + Math.random() * 15,
        });
      }
    };

    const drawPixelSprite = (sprite: string[], x: number, y: number, scale: number = SCALE) => {
      ctx.fillStyle = '#FFF';
      for (let r = 0; r < sprite.length; r++) {
        for (let c = 0; c < sprite[r].length; c++) {
          if (sprite[r][c] === '1') {
            ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
          }
        }
      }
    };

    const loop = () => {
      const s = stateRef.current;
      s.frame++;

      if (s.scrambleTimer > 0) {
        s.scrambleTimer--;
        s.currentName = Array.from(s.targetName).map(char => char === ' ' ? ' ' : getRandomChar()).join('');
        s.currentQuirk = Array.from(s.targetQuirk).map(char => char === ' ' ? ' ' : getRandomChar()).join('');

        if (s.scrambleTimer === 0) {
          s.currentName = s.targetName;
          s.currentQuirk = s.targetQuirk;
        }
      }

      s.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.life--;
      });
      s.particles = s.particles.filter(p => p.life > 0);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const spriteW = 20 * SCALE;
      const spriteX = CANVAS_WIDTH / 2 - spriteW / 2;
      const spriteY = CANVAS_HEIGHT / 2 - 120;

      let spriteToDraw: string[];
      if (s.currentCategory === 'SURPRISE ME') {
        spriteToDraw = ALL_SPRITES[s.plantIndex];
      } else {
        spriteToDraw = SPRITES_BY_CATEGORY[s.currentCategory][s.plantIndex];
      }

      let jx = s.scrambleTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
      let jy = s.scrambleTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
      if (s.scrambleTimer <= 0) jy = Math.sin(s.frame * 0.05) * 4;

      const plantHeightOffset = (20 - spriteToDraw.length) * SCALE;

      drawPixelSprite(spriteToDraw, spriteX + jx, spriteY + plantHeightOffset + jy);
      drawPixelSprite(SPRITES_POTS[s.potIndex], spriteX + jx, spriteY + (12 * SCALE) + jy);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      for (let y = spriteY - 10; y < spriteY + 140; y += 4) {
        ctx.fillRect(spriteX - 10, y, 140, 2);
      }

      s.particles.forEach(p => {
        ctx.fillStyle = '#FFF';
        ctx.fillRect(p.x, p.y, 4, 4);
      });

      ctx.font = '24px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = s.scrambleTimer > 0 && s.frame % 4 < 2 ? '#888' : '#FFF';
      ctx.fillText(s.currentName, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

      ctx.font = '12px monospace';
      ctx.fillStyle = s.scrambleTimer > 0 && s.frame % 4 >= 2 ? '#555' : '#AAA';
      ctx.fillText(s.currentQuirk, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);

      const catY = CANVAS_HEIGHT - 115;
      ctx.font = '14px monospace';
      ctx.fillStyle = '#AAA';
      ctx.fillText(`TYPE: ${s.currentCategory}`, CANVAS_WIDTH / 2, catY);

      ctx.fillStyle = s.hoverLeft ? '#FFF' : '#555';
      ctx.fillText('<', CANVAS_WIDTH / 2 - 120, catY);
      ctx.fillStyle = s.hoverRight ? '#FFF' : '#555';
      ctx.fillText('>', CANVAS_WIDTH / 2 + 120, catY);

      const btnW = 340;
      const btnH = 50;
      const btnX = CANVAS_WIDTH / 2 - btnW / 2;
      const btnY = CANVAS_HEIGHT - 75;

      if (s.hoverBtn) {
        ctx.fillStyle = '#FFF';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#000';
      } else {
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#FFF';
      }

      ctx.font = '16px monospace';
      ctx.fillText('[ CHRISTEN PLANT ]', CANVAS_WIDTH / 2, btnY + 30);

      requestAnimationFrame(loop);
    };

    const animId = requestAnimationFrame(loop);

    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleMouseDown);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchstart', handleMouseDown);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono select-none">
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      <div className="w-[800px] mb-4 text-center">
        <h1 className="text-2xl text-white m-0" style={{ fontFamily: '"Press Start 2P", monospace' }}>NAME YOUR PLANT</h1>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="outline-none"
        tabIndex={0}
      />
      <div className="mt-4 text-xs text-gray-500 text-center">
        [ &lt; / &gt; : CHANGE TYPE | ENTER / SPACE : CHRISTEN ]
      </div>
    </div>
  );
}
