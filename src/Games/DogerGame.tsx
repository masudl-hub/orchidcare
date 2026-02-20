import { useEffect, useRef } from 'react';

// --- CONFIG ---
const GAME_SPEED = 3;
const GROUND_Y = 280;
const PLAYER_X = 100;
const SCALE = 4;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;

// --- BIOME SYSTEM ---
const BIOME_DURATION = 700;   // frames fully in a biome
const TRANSITION_FRAMES = 100; // cross-fade frames

const BIOMES = ['PLAINS', 'PEAKS', 'FOREST', 'NIGHT'] as const;
type Biome = typeof BIOMES[number];

interface BiomeConfig {
  cloudAlpha: number;
  mountainAlpha: number;
  hillAlpha: number;
  treeAlpha: number;
  starAlpha: number;
  mountainStyle: 'gentle' | 'jagged';
}

const BIOME_CONFIG: Record<Biome, BiomeConfig> = {
  PLAINS:  { cloudAlpha: 0.13, mountainAlpha: 0.03, hillAlpha: 0.055, treeAlpha: 0,    starAlpha: 0,    mountainStyle: 'gentle' },
  PEAKS:   { cloudAlpha: 0.04, mountainAlpha: 0.10, hillAlpha: 0.01,  treeAlpha: 0,    starAlpha: 0.10, mountainStyle: 'jagged' },
  FOREST:  { cloudAlpha: 0.14, mountainAlpha: 0.02, hillAlpha: 0.04,  treeAlpha: 0.12, starAlpha: 0,    mountainStyle: 'gentle' },
  NIGHT:   { cloudAlpha: 0,    mountainAlpha: 0.02, hillAlpha: 0.015, treeAlpha: 0.05, starAlpha: 0.28, mountainStyle: 'gentle' },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const blendConfig = (idx: number, blend: number): BiomeConfig => {
  const cur = BIOME_CONFIG[BIOMES[idx]];
  const nxt = BIOME_CONFIG[BIOMES[(idx + 1) % BIOMES.length]];
  if (blend === 0) return cur;
  return {
    cloudAlpha:    lerp(cur.cloudAlpha,    nxt.cloudAlpha,    blend),
    mountainAlpha: lerp(cur.mountainAlpha, nxt.mountainAlpha, blend),
    hillAlpha:     lerp(cur.hillAlpha,     nxt.hillAlpha,     blend),
    treeAlpha:     lerp(cur.treeAlpha,     nxt.treeAlpha,     blend),
    starAlpha:     lerp(cur.starAlpha,     nxt.starAlpha,     blend),
    mountainStyle: blend < 0.5 ? cur.mountainStyle : nxt.mountainStyle,
  };
};

// --- GAME TYPES ---
type ObstacleType = 'CACTUS' | 'APHID' | 'CRACK';
interface Obstacle { x: number; type: ObstacleType; solved: boolean; width: number; }

// --- SPRITES ---
const PLANT_GROW_1 = [
  "   1 1    ",
  "  1 1 1   ",
  "   111    ",
  "   111    ",
  "    1     ",
  "    1     ",
  "  11111   ",
  "  11111   ",
  "  11111   ",
  "  11111   ",
  "  1    1  ",  // left foot
];
const PLANT_GROW_2 = [
  "  1   1   ",
  "   1 1    ",
  "   111    ",
  "   111    ",
  "    1     ",
  "    1     ",
  "  11111   ",
  "  11111   ",
  "  11111   ",
  "  11111   ",
  "   1   1  ",  // right foot
];
const PLANT_JUMP = [
  " 1  1  1  ",
  "  1 1 1   ",
  "   111    ",
  "   111    ",
  "   111    ",
  "   111    ",
  "    1     ",
  "  11111   ",
  "  11111   ",
  "  11111   ",
];
const PLANT_WILT = [
  "          ",
  "          ",
  "          ",
  "   1      ",
  "  111     ",
  " 111      ",
  "  11111   ",
  "  11111   ",
  "  11111   ",
  "  11111   ",
];

// --- CLOUD PIXEL SPRITES ---
const CLOUD_SPRITES = [
  ["  1111   ", " 111111  ", "111111111", " 1111111 "],
  ["  111    ", " 11111   ", "1111111  ", " 111111  "],
  ["     111 ", "  111111 ", " 1111111 ", "11111111 "],
  [" 1111111 ", "111111111", " 1111111 "],
  ["  11     ", " 1111    ", "111111   ", " 11111   "],
];

// --- TREE PIXEL SPRITES (drawn at scale 2) ---
const TREE_SPRITES = [
  // Pine
  ["  1  ", " 111 ", "11111", " 111 ", "  1  ", "  1  ", "  1  ", "  1  "],
  // Round canopy
  [" 111 ", "11111", "11111", " 111 ", "  1  ", "  1  ", "  1  "],
  // Tall thin
  [" 1 ", "111", " 1 ", "111", " 1 ", " 1 ", " 1 ", " 1 ", " 1 "],
  // Wide
  ["   1   ", " 11111 ", "1111111", " 11111 ", "   1   ", "   1   ", "   1   "],
];

// --- INTERFACE TYPES ---
interface BgCloud    { x: number; y: number; typeIdx: number; scale: number; }
interface BgMountain { x: number; w: number; h: number; }
interface BgHill     { x: number; w: number; h: number; }
interface BgTree     { x: number; typeIdx: number; }
interface BgStar     { x: number; y: number; size: number; }

export default function DogerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isAutoRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => { canvas.width = window.innerWidth; };
    handleResize();
    window.addEventListener('resize', handleResize);
    canvas.focus();

    let frame = 0;
    let totalFrames = 0;   // never resets — drives biome progression
    let animationId: number;
    let obstacles: Obstacle[] = [];
    let jumpBuffer = 0;
    let duckTimer = 0;
    let score = 0;

    // --- BACKGROUND STATE ---
    let bgClouds: BgCloud[] = [];
    let bgMountains: BgMountain[] = [];
    let bgHills: BgHill[] = [];
    let bgTrees: BgTree[] = [];
    let bgStars: BgStar[] = [];

    const initBg = () => {
      bgClouds = Array.from({ length: 7 }, (_, i) => ({
        x: (canvas.width / 6) * i + Math.random() * 120,
        y: 15 + Math.random() * 100,
        typeIdx: Math.floor(Math.random() * CLOUD_SPRITES.length),
        scale: 2 + Math.floor(Math.random() * 2),
      }));
      bgMountains = Array.from({ length: 5 }, (_, i) => ({
        x: (canvas.width / 4) * i + Math.random() * 120,
        w: 160 + Math.random() * 240,
        h: 55 + Math.random() * 100,
      }));
      bgHills = Array.from({ length: 6 }, (_, i) => ({
        x: (canvas.width / 5) * i + Math.random() * 100,
        w: 200 + Math.random() * 300,
        h: 25 + Math.random() * 50,
      }));
      bgTrees = Array.from({ length: 8 }, (_, i) => ({
        x: (canvas.width / 7) * i + Math.random() * 80,
        typeIdx: Math.floor(Math.random() * TREE_SPRITES.length),
      }));
      bgStars = Array.from({ length: 45 }, () => ({
        x: Math.random() * canvas.width,
        y: 8 + Math.random() * (GROUND_Y - 90),
        size: Math.random() < 0.25 ? 2 : 1,
      }));
    };
    initBg();

    // --- DRAW HELPERS ---
    const drawPixelSprite = (sprite: string[], x: number, y: number, sc: number = SCALE) => {
      for (let r = 0; r < sprite.length; r++) {
        for (let c = 0; c < sprite[r].length; c++) {
          if (sprite[r][c] === '1') {
            ctx.fillStyle = '#FFF';
            ctx.fillRect(x + c * sc, y + r * sc, sc, sc);
          }
        }
      }
    };

    const drawCloud = (cloud: BgCloud, alpha: number) => {
      if (alpha <= 0) return;
      const sprite = CLOUD_SPRITES[cloud.typeIdx];
      const sc = cloud.scale;
      for (let r = 0; r < sprite.length; r++) {
        for (let c = 0; c < sprite[r].length; c++) {
          if (sprite[r][c] === '1') {
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fillRect(cloud.x + c * sc, cloud.y + r * sc, sc, sc);
          }
        }
      }
    };

    // Render a silhouette as pixel columns — no smooth paths, pure 1-bit blocks
    const drawPixelSilhouette = (
      x: number,
      maxW: number,
      alpha: number,
      heightAt: (t: number) => number, // returns column height in px, already quantised
    ) => {
      if (alpha <= 0) return;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      for (let px = 0; px < maxW; px += SCALE) {
        const t = px / maxW;
        const colH = Math.round(heightAt(t) / SCALE) * SCALE;
        if (colH > 0) ctx.fillRect(x + px, GROUND_Y - colH, SCALE, colH);
      }
    };

    const drawMountain = (m: BgMountain, alpha: number, style: BiomeConfig['mountainStyle']) => {
      if (style === 'jagged') {
        // Three overlapping triangular peaks, quantised to pixel grid
        const peaks = [
          { pos: 0.25, h: 0.55 },
          { pos: 0.52, h: 1.00 },
          { pos: 0.78, h: 0.68 },
        ];
        drawPixelSilhouette(m.x, m.w, alpha, t =>
          m.h * peaks.reduce((best, p) =>
            Math.max(best, p.h * Math.max(0, 1 - Math.abs(t - p.pos) * 3.6)), 0)
        );
      } else {
        // Single rounded peak — parabola profile
        drawPixelSilhouette(m.x, m.w, alpha, t => m.h * 4 * t * (1 - t));
      }
    };

    const drawHill = (h: BgHill, alpha: number) => {
      // Sine arch — wider and lower than mountains
      drawPixelSilhouette(h.x, h.w, alpha, t => h.h * Math.sin(t * Math.PI));
    };

    const drawTree = (t: BgTree, alpha: number) => {
      if (alpha <= 0) return;
      const sprite = TREE_SPRITES[t.typeIdx];
      const sc = 2;
      const treeH = sprite.length * sc;
      const treeY = GROUND_Y - treeH;
      for (let r = 0; r < sprite.length; r++) {
        for (let c = 0; c < sprite[r].length; c++) {
          if (sprite[r][c] === '1') {
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fillRect(t.x + c * sc, treeY + r * sc, sc, sc);
          }
        }
      }
    };

    // --- GAME LOGIC ---
    const keys = { ArrowUp: false, ArrowDown: false, ArrowRight: false, Space: false };

    const player = {
      y: GROUND_Y,
      vy: 0,
      gravity: GRAVITY,
      jumpForce: JUMP_FORCE,
      isGrounded: true,
      state: 'RUNNING' as 'RUNNING' | 'JUMPING' | 'DUCKING' | 'BUILDING',
      actionTimer: 0,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        if (isAutoRef.current) {
          isAutoRef.current = false;
          player.state = 'RUNNING';
        }
        if (e.code === 'ArrowDown') keys.ArrowDown = true;
        if (e.code === 'ArrowRight') keys.ArrowRight = true;
        if (e.code === 'Space' || e.code === 'ArrowUp') jumpBuffer = 12;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') keys.ArrowDown = false;
      if (e.code === 'ArrowRight') keys.ArrowRight = false;
    };
    const handleTouchStart = (e: Event) => {
      if (e.type === 'touchstart') e.preventDefault();
      canvas.focus();
      if (isAutoRef.current) isAutoRef.current = false;
      jumpBuffer = 12;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleTouchStart);
    canvas.addEventListener('touchstart', handleTouchStart);

    const resetGame = () => {
      obstacles = [];
      frame = 0;
      score = 0;
      player.y = GROUND_Y;
      player.vy = 0;
      player.state = 'RUNNING';
      isAutoRef.current = true;
      jumpBuffer = 0;
      duckTimer = 0;
    };

    const spawnObstacle = () => {
      if (frame === 80 || (frame > 80 && (frame - 80) % 220 === 0)) {
        const r = Math.random();
        const type: ObstacleType = r < 0.33 ? 'CACTUS' : r < 0.66 ? 'APHID' : 'CRACK';
        obstacles.push({ x: canvas.width + 50, type, solved: false, width: 30 });
      }
    };

    const checkCollisions = () => {
      const pLeft = PLAYER_X + 10;
      const pRight = PLAYER_X + 30;
      const pBottom = player.y;
      const hitTop = player.state === 'DUCKING' ? player.y - 20 : player.y - 35;
      for (const obs of obstacles) {
        const oLeft = obs.x, oRight = obs.x + 30;
        if (obs.type === 'APHID') {
          if (pRight > oLeft && pLeft < oRight && pBottom > GROUND_Y - 55 && hitTop < GROUND_Y - 30) resetGame();
        } else if (obs.type === 'CRACK') {
          if (pRight > oLeft && pLeft < oRight && player.y >= GROUND_Y - 5 && !obs.solved) resetGame();
        } else {
          if (pRight > oLeft && pLeft < oRight && pBottom > GROUND_Y - 40 && hitTop < GROUND_Y) resetGame();
        }
      }
    };

    const runAI = () => {
      if (!isAutoRef.current) return;
      obstacles.forEach(obs => {
        const dist = obs.x - PLAYER_X;
        if (dist > 0 && dist < 250 && !obs.solved) {
          ctx.strokeStyle = '#555';
          ctx.setLineDash([2, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(PLAYER_X + 20, player.y - 30);
          ctx.lineTo(obs.x + 15, GROUND_Y - 20);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#888';
          ctx.fillRect(PLAYER_X + 10, player.y - 60, SCALE, SCALE);
          if (obs.type === 'CACTUS' && dist < 90) { jumpBuffer = 5; obs.solved = true; }
          else if (obs.type === 'APHID' && dist < 100 && player.isGrounded) {
            player.state = 'DUCKING';
            duckTimer = Math.ceil(dist / GAME_SPEED) + 15;
            obs.solved = true;
          } else if (obs.type === 'CRACK' && dist < 110) {
            player.state = 'BUILDING';
            player.actionTimer = 40;
            obs.solved = true;
          }
        }
      });
    };

    // --- MAIN LOOP ---
    const loop = () => {
      frame++;
      totalFrames++;
      if (frame % 6 === 0) score++;

      // Biome state (based on totalFrames — independent of game resets)
      const cycleLen = BIOME_DURATION + TRANSITION_FRAMES;
      const biomeIndex = Math.floor(totalFrames / cycleLen) % BIOMES.length;
      const phaseProgress = totalFrames % cycleLen;
      const biomeBlend = phaseProgress > BIOME_DURATION
        ? (phaseProgress - BIOME_DURATION) / TRANSITION_FRAMES
        : 0;
      const cfg = blendConfig(biomeIndex, biomeBlend);

      // --- PLAYER PHYSICS ---
      if (!isAutoRef.current) {
        if (keys.ArrowDown) { player.state = 'DUCKING'; }
        else if (keys.ArrowRight) {
          player.state = 'BUILDING';
          obstacles.forEach(o => {
            if (o.type === 'CRACK' && o.x > PLAYER_X - 50 && o.x < PLAYER_X + 300) o.solved = true;
          });
        } else if (!player.isGrounded) { player.state = 'JUMPING'; }
        else { player.state = 'RUNNING'; }
      }

      if (jumpBuffer > 0 && player.isGrounded) {
        player.vy = player.jumpForce;
        player.isGrounded = false;
        player.state = 'JUMPING';
        jumpBuffer = 0;
      }
      if (jumpBuffer > 0) jumpBuffer--;

      player.y += player.vy;
      player.vy += player.gravity;
      if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.isGrounded = true;
        if (isAutoRef.current && player.state === 'JUMPING') player.state = 'RUNNING';
      } else {
        player.isGrounded = false;
      }

      if (isAutoRef.current && player.actionTimer > 0) {
        player.actionTimer--;
        if (player.actionTimer === 0 && player.isGrounded) player.state = 'RUNNING';
      }
      if (duckTimer > 0) {
        duckTimer--;
        if (duckTimer === 0) player.state = 'RUNNING';
      }

      spawnObstacle();
      obstacles.forEach(o => o.x -= GAME_SPEED);
      obstacles = obstacles.filter(o => o.x > -100);
      checkCollisions();

      // --- RENDER ---
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars (PEAKS / NIGHT)
      if (cfg.starAlpha > 0) {
        bgStars.forEach(s => {
          s.x -= GAME_SPEED * 0.06;
          if (s.x < 0) {
            s.x = canvas.width + Math.random() * 100;
            s.y = 8 + Math.random() * (GROUND_Y - 90);
          }
          ctx.fillStyle = `rgba(255,255,255,${cfg.starAlpha})`;
          ctx.fillRect(s.x, s.y, s.size, s.size);
        });
      }

      // Mountains — back layer, slowest scroll
      bgMountains.forEach(m => {
        m.x -= GAME_SPEED * 0.10;
        if (m.x + m.w < 0) {
          m.x = canvas.width + Math.random() * 200;
          m.w = 160 + Math.random() * 240;
          m.h = 55 + Math.random() * 100;
        }
        drawMountain(m, cfg.mountainAlpha, cfg.mountainStyle);
      });

      // Hills — mid layer, smooth bezier curves
      bgHills.forEach(h => {
        h.x -= GAME_SPEED * 0.22;
        if (h.x + h.w < 0) {
          h.x = canvas.width + Math.random() * 150;
          h.w = 200 + Math.random() * 300;
          h.h = 25 + Math.random() * 50;
        }
        drawHill(h, cfg.hillAlpha);
      });

      // Clouds
      bgClouds.forEach(c => {
        c.x -= GAME_SPEED * (0.28 + c.scale * 0.04);
        if (c.x + c.scale * 9 < 0) {
          c.x = canvas.width + Math.random() * 300;
          c.y = 15 + Math.random() * 100;
          c.typeIdx = Math.floor(Math.random() * CLOUD_SPRITES.length);
          c.scale = 2 + Math.floor(Math.random() * 2);
        }
        drawCloud(c, cfg.cloudAlpha);
      });

      // Trees — near horizon (FOREST / NIGHT)
      bgTrees.forEach(t => {
        t.x -= GAME_SPEED * 0.55;
        if (t.x + 18 < 0) {
          t.x = canvas.width + Math.random() * 200;
          t.typeIdx = Math.floor(Math.random() * TREE_SPRITES.length);
        }
        drawTree(t, cfg.treeAlpha);
      });

      // Ground line
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(canvas.width, GROUND_Y);
      ctx.stroke();

      runAI();

      // Obstacles
      obstacles.forEach(o => {
        if (o.type === 'CRACK') {
          if (o.solved) {
            ctx.fillStyle = '#FFF';
            ctx.fillRect(o.x, GROUND_Y - 2, 80, 4);
            ctx.fillStyle = '#888';
            [10, 30, 50, 70].forEach(off => ctx.fillRect(o.x + off, GROUND_Y - 2, 5, 4));
          } else {
            ctx.fillStyle = '#FFF';
            ctx.fillRect(o.x + 5, GROUND_Y - 2, 3, 20);
            ctx.fillRect(o.x + 15, GROUND_Y - 5, 3, 15);
            ctx.fillRect(o.x + 25, GROUND_Y - 3, 3, 18);
            ctx.fillRect(o.x + 35, GROUND_Y - 6, 3, 16);
            ctx.fillRect(o.x + 45, GROUND_Y - 4, 3, 20);
          }
        } else if (o.type === 'CACTUS') {
          ctx.fillStyle = '#FFF';
          ctx.fillRect(o.x + 10, GROUND_Y - 40, 10, 40);
          ctx.fillRect(o.x, GROUND_Y - 30, 10, 5);
          ctx.fillRect(o.x, GROUND_Y - 30, 5, -10);
          ctx.fillRect(o.x + 20, GROUND_Y - 25, 10, 5);
          ctx.fillRect(o.x + 25, GROUND_Y - 25, 5, -10);
          ctx.fillRect(o.x + 10, GROUND_Y - 45, 4, 4);
          ctx.fillRect(o.x + 16, GROUND_Y - 45, 4, 4);
          ctx.fillRect(o.x + 13, GROUND_Y - 48, 4, 4);
          ctx.fillRect(o.x + 13, GROUND_Y - 42, 4, 4);
        } else if (o.type === 'APHID') {
          const yPos = GROUND_Y - 55;
          const wingOffset = (Math.floor(frame / 10) % 2 === 0) ? -2 : 2;
          ctx.fillStyle = '#FFF';
          ctx.fillRect(o.x + 5, yPos, 10, 6);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(o.x + 2, yPos + wingOffset, 6, 3);
          ctx.fillRect(o.x + 14, yPos + wingOffset, 6, 3);
          ctx.fillStyle = '#FFF';
          ctx.fillRect(o.x + 13, yPos + 1, 4, 4);
        }
      });

      // Player
      let sprite = PLANT_GROW_1;
      if (player.state === 'DUCKING') sprite = PLANT_WILT;
      else if (player.isGrounded) sprite = (Math.floor(frame / 10) % 2 === 0) ? PLANT_GROW_1 : PLANT_GROW_2;
      else sprite = PLANT_JUMP;
      drawPixelSprite(sprite, PLAYER_X, player.y - sprite.length * SCALE);

      // Score
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(String(score).padStart(5, '0'), canvas.width - 20, 36);

      // Status hint
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(
        isAutoRef.current ? '[ CLICK TO TAKE OVER ]' : '[ SPACE=JUMP  DOWN=WILT  RIGHT=WATER ]',
        canvas.width / 2,
        GROUND_Y + 22,
      );

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', handleTouchStart);
      canvas.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      <canvas
        ref={canvasRef}
        height={400}
        tabIndex={0}
        className="outline-none w-screen block"
        style={{ imageRendering: 'pixelated', marginTop: 'auto', marginBottom: 'auto' }}
      />
    </div>
  );
}
