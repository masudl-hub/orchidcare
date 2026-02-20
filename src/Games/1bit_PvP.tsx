{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import React, \{ useEffect, useRef, useState \} from 'react';\
\
// --- CONFIG ---\
const GAME_SPEED = 1;\
const SCALE = 4;\
const CELL_SIZE = 60;\
const ROWS = 5;\
const COLS = 9;\
const BOARD_OFFSET_X = 130; \
const BOARD_OFFSET_Y = 50;\
const CANVAS_WIDTH = 800;\
const CANVAS_HEIGHT = 400;\
const MAX_WAVES = 10;\
\
// --- TYPES ---\
type ToolType = 'MISTER' | 'UV_LAMP' | 'TRAP' | 'FLYTRAP';\
type PestType = 'APHID' | 'MEALYBUG' | 'SPIDER_MITE' | 'SNAIL' | 'SLUG_KING';\
type GameState = 'PLAYING' | 'GAME_OVER' | 'VICTORY';\
\
interface Tool \{\
  id: number;\
  r: number;\
  c: number;\
  type: ToolType;\
  hp: number;\
  maxHp: number;\
  actionTimer: number;\
  flash: number; \
  state?: 'WAITING' | 'FED'; \
\}\
\
interface Pest \{\
  id: number;\
  r: number;\
  x: number;\
  hp: number;\
  maxHp: number;\
  speed: number;\
  eatingTimer: number;\
  state: 'CRAWLING' | 'INFESTING';\
  type: PestType;\
  flash: number;\
  status: \{\
    wet: boolean;\
    wetTimer: number;\
    slowed: boolean;\
  \}\
\}\
\
interface Droplet \{\
  id: number;\
  r: number;\
  x: number;\
  damage: number;\
  dead: boolean;\
  type: 'WATER' | 'UV_BEAM';\
\}\
\
interface Particle \{\
  x: number;\
  y: number;\
  vx: number;\
  vy: number;\
  life: number;\
  color?: string;\
\}\
\
// --- SPRITES ---\
// (We keep the sprites but add the BOSS)\
\
const SPRITE_MISTER = [ \
  "    11    ",\
  "   1  1   ",\
  "    11    ",\
  "   1111   ",\
  "  111111  ",\
  "  111111  ",\
  "  111111  ",\
  "  111111  ",\
  "  111111  ",\
  "   1111   "\
];\
\
const SPRITE_LAMP = [ \
  "   1111   ",\
  "  111111  ",\
  " 11111111 ",\
  " 1 1111 1 ",\
  " 1 1111 1 ",\
  "   1111   ",\
  "    11    ",\
  "    11    ",\
  "   1111   ",\
  "  111111  "\
];\
\
const SPRITE_TRAP = [ \
  "  111111  ",\
  "  111111  ",\
  "  111111  ",\
  "  111111  ",\
  "  111111  ",\
  "   1111   ",\
  "    11    ",\
  "    11    ",\
  "    11    ",\
  "    11    "\
];\
\
const SPRITE_FLYTRAP = [ \
  " 1      1 ",\
  " 11    11 ",\
  " 11    11 ",\
  "  11  11  ",\
  "  111111  ",\
  "   1111   ",\
  "    11    ",\
  "   1111   ",\
  "  11  11  ",\
  " 11    11 "\
];\
\
const SPRITE_FLYTRAP_FED = [ \
  "          ",\
  "          ",\
  "    11    ",\
  "   1111   ",\
  "  111111  ",\
  "   1111   ",\
  "    11    ",\
  "   1111   ",\
  "  11  11  ",\
  " 11    11 "\
];\
\
// -- PESTS --\
const SPRITE_APHID = [ \
  "          ",\
  "          ",\
  "   1111   ",\
  "  111111  ",\
  " 11111111 ",\
  " 11111111 ",\
  "  111111  ",\
  "  1 11 1  ",\
  " 1      1 ",\
  "          "\
];\
\
const SPRITE_MEALYBUG = [ \
  "   1  1   ",\
  "  111111  ",\
  " 11111111 ",\
  "1111111111",\
  "1111111111",\
  "1111111111",\
  " 11111111 ",\
  "  111111  ",\
  "  1 11 1  ",\
  " 1      1 "\
];\
\
const SPRITE_SPIDER_MITE = [\
  "          ",\
  "  1    1  ",\
  " 111  111 ",\
  "  111111  ",\
  "  111111  ",\
  " 11111111 ",\
  " 1      1 ",\
  " 1      1 ",\
  "          ",\
  "          "\
];\
\
const SPRITE_SNAIL = [\
  "          ",\
  "      11  ",\
  "     1  1 ",\
  "    1    1",\
  "   11111 1",\
  "  11111111",\
  " 111111111",\
  "1111111111",\
  "          ",\
  "          "\
];\
\
const SPRITE_SLUG_KING = [ // 16x16 sprite scaled differently or just big\
  "      111       ",\
  "     11111      ",\
  "    111 111     ",\
  "   111   111    ",\
  "   111111111    ",\
  "  11111111111   ",\
  "  11111111111   ",\
  " 1111111111111  ",\
  " 1111111111111  ",\
  " 1111111111111  ",\
  "111111111111111 ",\
  "111111111111111 ",\
  "111111111111111 ",\
  " 1111111111111  ",\
  "  11111111111   ",\
  "   111111111    "\
];\
\
// Bayer Matrix for dithering 4x4\
const BAYER_MATRIX = [\
  [0, 8, 2, 10],\
  [12, 4, 14, 6],\
  [3, 11, 1, 9],\
  [15, 7, 13, 5]\
];\
\
export default function App() \{\
  const canvasRef = useRef<HTMLCanvasElement>(null);\
  const [isAuto, setIsAuto] = useState(true);\
  const [selectedTool, setSelectedTool] = useState<ToolType>('MISTER');\
  const [lightUI, setLightUI] = useState(500); // BUFF: 500 starting light\
  const [waveUI, setWaveUI] = useState(1);\
  const [gameState, setGameState] = useState<GameState>('PLAYING');\
  \
  const stateRef = useRef(\{\
    gameState: 'PLAYING' as GameState,\
    isAuto: true,\
    light: 500, // BUFF: 500 starting light\
    frame: 0,\
    tools: [] as Tool[],\
    pests: [] as Pest[],\
    droplets: [] as Droplet[],\
    particles: [] as Particle[],\
    idCounter: 0,\
    selectedTool: 'MISTER' as ToolType,\
    wave: 1,\
    pestsSpawnedInWave: 0,\
    mouseX: 0,\
    mouseY: 0,\
    shake: 0\
  \});\
\
  useEffect(() => \{\
    const canvas = canvasRef.current;\
    if (!canvas) return;\
    const ctx = canvas.getContext('2d');\
    if (!ctx) return;\
    \
    ctx.imageSmoothingEnabled = false;\
\
    const COSTS: Record<ToolType, number> = \{ MISTER: 100, UV_LAMP: 75, TRAP: 50, FLYTRAP: 150 \};\
\
    const resetGame = () => \{\
        const s = stateRef.current;\
        s.gameState = 'PLAYING';\
        s.light = 500; // Reset to 500\
        s.frame = 0;\
        s.tools = [];\
        s.pests = [];\
        s.droplets = [];\
        s.particles = [];\
        s.wave = 1;\
        s.pestsSpawnedInWave = 0;\
        s.shake = 0;\
        s.isAuto = true;\
        setGameState('PLAYING');\
        setLightUI(500); // Reset UI\
        setWaveUI(1);\
        setIsAuto(true);\
    \};\
\
    const handleKeyDown = (e: KeyboardEvent) => \{\
      const s = stateRef.current;\
      if (s.gameState !== 'PLAYING') \{\
          if (e.code === 'Space' || e.code === 'Enter') resetGame();\
          return;\
      \}\
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) \{\
        s.isAuto = false;\
        setIsAuto(false);\
        if (e.code === 'Digit1') \{ s.selectedTool = 'MISTER'; setSelectedTool('MISTER'); \}\
        if (e.code === 'Digit2') \{ s.selectedTool = 'UV_LAMP'; setSelectedTool('UV_LAMP'); \}\
        if (e.code === 'Digit3') \{ s.selectedTool = 'TRAP'; setSelectedTool('TRAP'); \}\
        if (e.code === 'Digit4') \{ s.selectedTool = 'FLYTRAP'; setSelectedTool('FLYTRAP'); \}\
      \}\
    \};\
\
    const handleMouseMove = (e: MouseEvent) => \{\
        const s = stateRef.current;\
        const rect = canvas.getBoundingClientRect();\
        s.mouseX = e.clientX - rect.left;\
        s.mouseY = e.clientY - rect.top;\
    \};\
\
    const handleMouseDown = (e: MouseEvent | TouchEvent) => \{\
        const s = stateRef.current;\
        if (s.gameState !== 'PLAYING') \{ resetGame(); return; \}\
        s.isAuto = false;\
        setIsAuto(false);\
\
        const rect = canvas.getBoundingClientRect();\
        let clientX = 0, clientY = 0;\
        if (window.TouchEvent && e instanceof TouchEvent) \{\
             clientX = e.touches[0].clientX;\
             clientY = e.touches[0].clientY;\
        \} else \{\
             clientX = (e as MouseEvent).clientX;\
             clientY = (e as MouseEvent).clientY;\
        \}\
\
        const x = clientX - rect.left;\
        const y = clientY - rect.top;\
\
        if (x < BOARD_OFFSET_X) \{\
            if (y > 50 && y < 100) \{ s.selectedTool = 'MISTER'; setSelectedTool('MISTER'); return; \}\
            if (y > 110 && y < 160) \{ s.selectedTool = 'UV_LAMP'; setSelectedTool('UV_LAMP'); return; \}\
            if (y > 170 && y < 220) \{ s.selectedTool = 'TRAP'; setSelectedTool('TRAP'); return; \}\
            if (y > 230 && y < 280) \{ s.selectedTool = 'FLYTRAP'; setSelectedTool('FLYTRAP'); return; \}\
        \}\
\
        const c = Math.floor((x - BOARD_OFFSET_X) / CELL_SIZE);\
        const r = Math.floor((y - BOARD_OFFSET_Y) / CELL_SIZE);\
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) \{\
            attemptPlacement(r, c, s.selectedTool);\
        \}\
    \};\
\
    const attemptPlacement = (r: number, c: number, type: ToolType) => \{\
        const s = stateRef.current;\
        const cost = COSTS[type];\
        if (s.tools.find(p => p.r === r && p.c === c)) return;\
\
        if (s.light >= cost) \{\
            s.light -= cost;\
            setLightUI(s.light);\
            \
            let hp = 100;\
            if (type === 'TRAP') hp = 800; \
            if (type === 'FLYTRAP') hp = 200;\
\
            s.tools.push(\{\
                id: s.idCounter++,\
                r, c, type,\
                hp, maxHp: hp,\
                actionTimer: 0, flash: 0,\
                state: type === 'FLYTRAP' ? 'WAITING' : undefined\
            \});\
\
            spawnParticles(\
                BOARD_OFFSET_X + c * CELL_SIZE + CELL_SIZE/2, \
                BOARD_OFFSET_Y + r * CELL_SIZE + CELL_SIZE/2, \
                8\
            );\
            s.shake = 2; // Slight shake on placement\
        \}\
    \};\
\
    const spawnParticles = (x: number, y: number, count: number, color?: string) => \{\
        const s = stateRef.current;\
        for(let i=0; i<count; i++) \{\
            s.particles.push(\{\
                x, y,\
                vx: (Math.random() - 0.5) * 6,\
                vy: (Math.random() - 0.5) * 6,\
                life: 20 + Math.random() * 15,\
                color\
            \});\
        \}\
    \};\
\
    const drawPixelSprite = (sprite: string[], x: number, y: number, scale: number = SCALE) => \{\
      ctx.fillStyle = '#FFF';\
      for (let r = 0; r < sprite.length; r++) \{\
        for (let c = 0; c < sprite[r].length; c++) \{\
          if (sprite[r][c] === '1') \{\
            ctx.fillRect(x + c * scale, y + r * scale, scale, scale);\
          \}\
        \}\
      \}\
    \};\
\
    const runAI = () => \{\
        const s = stateRef.current;\
        if (!s.isAuto) return;\
        if (s.frame % 15 === 0) \{\
            const types: ToolType[] = ['MISTER', 'UV_LAMP', 'TRAP', 'FLYTRAP'];\
            let typeToTry: ToolType = 'MISTER';\
            \
            const lampCount = s.tools.filter(p => p.type === 'UV_LAMP').length;\
            const misterCount = s.tools.filter(p => p.type === 'MISTER').length;\
\
            if (lampCount < 2) typeToTry = 'UV_LAMP';\
            else if (misterCount < 5) typeToTry = 'MISTER'; // Prioritize more misters early\
            else if (s.light > 200) typeToTry = types[Math.floor(Math.random() * types.length)];\
            \
            if (s.light >= COSTS[typeToTry]) \{\
                // SMART AI: Prioritize rows that have pests in them!\
                const threatenedRows = [...new Set(s.pests.map(p => p.r))];\
                const r = threatenedRows.length > 0 \
                    ? threatenedRows[Math.floor(Math.random() * threatenedRows.length)] \
                    : Math.floor(Math.random() * ROWS);\
                \
                const c = Math.floor(Math.random() * (COLS - 2)); // Don't plant too close to the spawn edge\
                attemptPlacement(r, c, typeToTry);\
            \}\
        \}\
    \};\
\
    // --- RENDER HELPERS ---\
    \
    // Dithering pattern function\
    const isDithered = (x: number, y: number, brightness: number) => \{\
       // Map coords to Bayer Matrix 4x4\
       const tx = Math.floor(x) % 4;\
       const ty = Math.floor(y) % 4;\
       const threshold = BAYER_MATRIX[ty][tx] / 16;\
       return brightness > threshold;\
    \};\
\
    // --- MAIN LOOP ---\
    const loop = () => \{\
      const s = stateRef.current;\
      \
      if (s.gameState !== 'PLAYING') \{\
          renderEndScreen();\
          requestAnimationFrame(loop);\
          return;\
      \}\
\
      s.frame++;\
      if (s.shake > 0) s.shake *= 0.9;\
      if (s.shake < 0.5) s.shake = 0;\
\
      // 1. WAVE LOGIC\
      // Adjusted spawn rate to keep the pressure on\
      const baseSpawnRate = Math.max(45, 200 - (s.wave * 15));\
      const pestsPerWave = 8 + (s.wave * 4); // BUFF: More bugs per wave to increase tension\
\
      if (s.frame % baseSpawnRate === 0 && s.pestsSpawnedInWave < pestsPerWave) \{\
          s.pestsSpawnedInWave++;\
          const row = Math.floor(Math.random() * ROWS);\
          let pestType: PestType = 'APHID';\
          \
          const r = Math.random();\
          if (s.wave === MAX_WAVES && s.pestsSpawnedInWave === pestsPerWave) \{\
               pestType = 'SLUG_KING'; // Boss spawn at end of final wave\
          \} else \{\
             // Full variety from Wave 1\
             if (r < 0.4) pestType = 'APHID';\
             else if (r < 0.65) pestType = 'SPIDER_MITE';\
             else if (r < 0.85) pestType = 'MEALYBUG';\
             else pestType = 'SNAIL';\
          \}\
\
          // BUFF: Rebalanced enemy health and speeds for the faster game pace\
          let hp = 80;\
          let speed = 0.3;\
\
          if (pestType === 'MEALYBUG') \{ hp = 200; speed = 0.2; \}\
          if (pestType === 'SPIDER_MITE') \{ hp = 40; speed = 0.6; \}\
          if (pestType === 'SNAIL') \{ hp = 400; speed = 0.1; \}\
          if (pestType === 'SLUG_KING') \{ hp = 3000; speed = 0.08; \}\
          \
          hp += ((s.wave - 1) * 15); // FIXED: Wave 1 doesn't get bonus HP now\
\
          s.pests.push(\{\
              id: s.idCounter++,\
              r: row,\
              x: CANVAS_WIDTH + 20,\
              hp, maxHp: hp, speed,\
              eatingTimer: 0,\
              state: 'CRAWLING',\
              type: pestType,\
              flash: 0,\
              status: \{ wet: false, wetTimer: 0, slowed: false \}\
          \});\
      \}\
\
      if (s.pestsSpawnedInWave >= pestsPerWave && s.pests.length === 0) \{\
          if (s.wave >= MAX_WAVES) \{\
              s.gameState = 'VICTORY';\
              setGameState('VICTORY');\
          \} else \{\
              s.wave++;\
              s.pestsSpawnedInWave = 0;\
              setWaveUI(s.wave);\
              s.light += 100; // Adjusted wave clear bonus\
              setLightUI(s.light);\
              // Wave clear shake\
              s.shake = 5;\
          \}\
      \}\
\
      // Slightly faster passive light generation\
      if (s.frame % 100 === 0) \{ s.light += 25; setLightUI(s.light); \}\
\
      // 2. Tool Updates\
      s.tools.forEach(p => \{\
          if (p.flash > 0) p.flash--;\
          p.actionTimer++;\
\
          // Flytrap\
          if (p.type === 'FLYTRAP') \{\
              if (p.state === 'FED' && p.actionTimer > 250) p.state = 'WAITING'; // Slightly longer digestion\
              \
              if (p.state === 'WAITING') \{\
                  const victim = s.pests.find(z => \
                      z.r === p.r && \
                      Math.abs(z.x - (BOARD_OFFSET_X + p.c * CELL_SIZE + CELL_SIZE/2)) < 30\
                  );\
                  if (victim) \{\
                      if (victim.type === 'SLUG_KING') \{\
                          victim.hp -= 200; // Can't eat boss whole\
                          s.shake = 3;\
                      \} else \{\
                          victim.hp -= 9999;\
                          s.shake = 2;\
                      \}\
                      p.state = 'FED';\
                      p.actionTimer = 0;\
                      spawnParticles(victim.x, BOARD_OFFSET_Y + victim.r * CELL_SIZE + 20, 10);\
                  \}\
              \}\
          \}\
\
          // UV Lamp - Synergy Tool\
          if (p.type === 'UV_LAMP' && p.actionTimer >= 60) \{ \
              // Generates light slower, but attacks!\
              if (s.frame % 300 === 0) \{ s.light += 25; setLightUI(s.light); \}\
\
              // Attack logic: Zaps nearest pest in lane THAT IS ON SCREEN\
              const target = s.pests.find(z => z.r === p.r && z.x > (BOARD_OFFSET_X + p.c * CELL_SIZE) && z.x <= CANVAS_WIDTH);\
              if (target) \{\
                  s.droplets.push(\{\
                      id: s.idCounter++,\
                      r: p.r,\
                      x: BOARD_OFFSET_X + p.c * CELL_SIZE + 40,\
                      damage: 15, // BUFF: Damage increased\
                      dead: false,\
                      type: 'UV_BEAM'\
                  \});\
                  p.actionTimer = 0;\
              \}\
          \}\
\
          // Mister - Applies Wet\
          if (p.type === 'MISTER' && p.actionTimer >= 35) \{ // BUFF: Fires faster\
              // Attack logic: Shoots only if pest IS ON SCREEN\
              const hasTarget = s.pests.some(z => z.r === p.r && z.x > (BOARD_OFFSET_X + p.c * CELL_SIZE) && z.x <= CANVAS_WIDTH);\
              if (hasTarget) \{\
                  s.droplets.push(\{\
                      id: s.idCounter++,\
                      r: p.r,\
                      x: BOARD_OFFSET_X + p.c * CELL_SIZE + 40,\
                      damage: 20, // BUFF: Damage increased\
                      dead: false,\
                      type: 'WATER'\
                  \});\
                  p.actionTimer = 0;\
              \}\
          \}\
      \});\
\
      // 3. Projectiles\
      s.droplets.forEach(proj => \{\
          proj.x += (proj.type === 'UV_BEAM' ? 24 : 12); // Lasers are fast\
          if (proj.x > CANVAS_WIDTH) proj.dead = true;\
      \});\
\
      // 4. Pests\
      s.pests.forEach(z => \{\
          if (z.flash > 0) z.flash--;\
          if (z.status.wetTimer > 0) z.status.wetTimer--;\
          z.status.wet = z.status.wetTimer > 0;\
          \
          const toolInFront = s.tools.find(p => \
              p.r === z.r && \
              Math.abs((BOARD_OFFSET_X + p.c * CELL_SIZE + 20) - z.x) < 20 &&\
              (p.type !== 'FLYTRAP' || p.state === 'FED')\
          );\
\
          if (toolInFront) \{\
              z.state = 'INFESTING';\
              z.eatingTimer++;\
              if (z.eatingTimer % 15 === 0) \{ \
                  toolInFront.hp -= (z.type === 'SLUG_KING' ? 100 : 20);\
                  toolInFront.flash = 5;\
                  s.shake = z.type === 'SLUG_KING' ? 2 : 0;\
                  spawnParticles(BOARD_OFFSET_X + toolInFront.c * CELL_SIZE + 30, BOARD_OFFSET_Y + toolInFront.r * CELL_SIZE + 30, 2);\
              \}\
          \} else \{\
              z.state = 'CRAWLING';\
              let moveSpeed = z.speed;\
              if (z.status.wet) moveSpeed *= 0.7; // Wet pests are slower\
\
              z.x -= moveSpeed;\
              \
              if (z.x < BOARD_OFFSET_X - 30) \{\
                 s.gameState = 'GAME_OVER';\
                 setGameState('GAME_OVER');\
                 s.shake = 10;\
              \}\
          \}\
      \});\
\
      // 5. Collisions & Synergy\
      s.droplets.forEach(proj => \{\
          if (proj.dead) return;\
          const hitPest = s.pests.find(z => \
              z.r === proj.r && \
              Math.abs(z.x - proj.x) < 25 &&\
              z.x < CANVAS_WIDTH\
          );\
\
          if (hitPest) \{\
              let dmg = proj.damage;\
              \
              // SYNERGY: UV Beam does 3x damage to Wet targets\
              if (proj.type === 'UV_BEAM' && hitPest.status.wet) \{\
                  dmg *= 3;\
                  spawnParticles(hitPest.x, BOARD_OFFSET_Y + hitPest.r * CELL_SIZE, 5, '#FFF'); // Spark effect\
              \}\
              // Mister applies wet\
              if (proj.type === 'WATER') \{\
                  hitPest.status.wet = true;\
                  hitPest.status.wetTimer = 180;\
              \}\
\
              hitPest.hp -= dmg;\
              hitPest.flash = 5;\
              proj.dead = true;\
              \
              // Hit particles\
              spawnParticles(hitPest.x + 20, BOARD_OFFSET_Y + hitPest.r * CELL_SIZE + 20, 2);\
          \}\
      \});\
\
      // 6. Cleanup\
      s.tools = s.tools.filter(p => p.hp > 0);\
      s.pests = s.pests.filter(z => \{\
          if (z.hp <= 0) \{\
              // Death shake\
              if (z.type === 'SLUG_KING') s.shake = 15;\
              else if (z.type === 'SNAIL') s.shake = 1;\
              return false;\
          \}\
          return true;\
      \});\
      s.droplets = s.droplets.filter(p => !p.dead);\
      \
      s.particles.forEach(p => \{\
          p.x += p.vx;\
          p.y += p.vy;\
          p.vy += 0.2; // Gravity\
          // Bounce off floor\
          if (p.y > BOARD_OFFSET_Y + (ROWS * CELL_SIZE) + 20) \{\
             p.y = BOARD_OFFSET_Y + (ROWS * CELL_SIZE) + 20;\
             p.vy *= -0.5;\
          \}\
          p.life--;\
      \});\
      s.particles = s.particles.filter(p => p.life > 0);\
\
      runAI();\
      renderGame();\
      requestAnimationFrame(loop);\
    \};\
\
    // --- RENDER ---\
    const renderGame = () => \{\
        const s = stateRef.current;\
        \
        // Shake Offset\
        const sx = (Math.random() - 0.5) * s.shake;\
        const sy = (Math.random() - 0.5) * s.shake;\
\
        ctx.save();\
        ctx.translate(sx, sy);\
\
        ctx.fillStyle = '#000';\
        ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);\
\
        // Sidebar Icons\
        drawPixelSprite(SPRITE_MISTER, 10, 60);\
        drawPixelSprite(SPRITE_LAMP, 10, 120);\
        drawPixelSprite(SPRITE_TRAP, 10, 180);\
        drawPixelSprite(SPRITE_FLYTRAP, 10, 240);\
        \
        // Selection\
        ctx.strokeStyle = '#FFF';\
        ctx.lineWidth = 2;\
        let selY = 55;\
        if (s.selectedTool === 'UV_LAMP') selY = 115;\
        if (s.selectedTool === 'TRAP') selY = 175;\
        if (s.selectedTool === 'FLYTRAP') selY = 235;\
        ctx.strokeRect(5, selY, 50, 50);\
\
        // Grid\
        ctx.strokeStyle = '#333';\
        const drawDottedLine = (x1: number, y1: number, x2: number, y2: number) => \{\
            ctx.setLineDash([1, 7]); \
            ctx.beginPath();\
            ctx.moveTo(x1, y1);\
            ctx.lineTo(x2, y2);\
            ctx.stroke();\
            ctx.setLineDash([]);\
        \};\
\
        ctx.strokeStyle = '#555'; // Darker grid for atmosphere\
        for (let r = 0; r <= ROWS; r++) \{\
            drawDottedLine(BOARD_OFFSET_X, BOARD_OFFSET_Y + r * CELL_SIZE, BOARD_OFFSET_X + COLS * CELL_SIZE, BOARD_OFFSET_Y + r * CELL_SIZE);\
        \}\
        for (let c = 0; c <= COLS; c++) \{\
            drawDottedLine(BOARD_OFFSET_X + c * CELL_SIZE, BOARD_OFFSET_Y, BOARD_OFFSET_X + c * CELL_SIZE, BOARD_OFFSET_Y + ROWS * CELL_SIZE);\
        \}\
\
        // --- DRAW ENTITIES ---\
        \
        // Tools\
        s.tools.forEach(p => \{\
            const x = BOARD_OFFSET_X + p.c * CELL_SIZE + 10;\
            const y = BOARD_OFFSET_Y + p.r * CELL_SIZE + 10;\
            let sprite = SPRITE_MISTER;\
            if (p.type === 'UV_LAMP') sprite = SPRITE_LAMP;\
            if (p.type === 'TRAP') sprite = SPRITE_TRAP;\
            if (p.type === 'FLYTRAP') sprite = (p.state === 'WAITING') ? SPRITE_FLYTRAP : SPRITE_FLYTRAP_FED;\
\
            let yOff = 0;\
            if (p.type === 'UV_LAMP' && Math.floor(s.frame / 20) % 2 === 0) yOff = -2;\
\
            if (p.flash > 0) \{\
                ctx.globalCompositeOperation = 'xor';\
                drawPixelSprite(sprite, x, y + yOff);\
                ctx.globalCompositeOperation = 'source-over';\
            \} else \{\
                drawPixelSprite(sprite, x, y + yOff);\
            \}\
        \});\
\
        // Pests\
        s.pests.forEach(z => \{\
            const y = BOARD_OFFSET_Y + z.r * CELL_SIZE + 5;\
            let sprite = SPRITE_APHID;\
            let scale = SCALE;\
            let yAdj = 0;\
\
            if (z.type === 'MEALYBUG') sprite = SPRITE_MEALYBUG;\
            else if (z.type === 'SPIDER_MITE') sprite = SPRITE_SPIDER_MITE;\
            else if (z.type === 'SNAIL') sprite = SPRITE_SNAIL;\
            else if (z.type === 'SLUG_KING') \{ \
                sprite = SPRITE_SLUG_KING; \
                scale = 6; \
                yAdj = -30; // Center big sprite\
            \}\
\
            if (z.status.wet) \{\
                // Wet Effect: Draw drops above\
                if (s.frame % 20 < 10) \{\
                    ctx.fillStyle = '#FFF';\
                    ctx.fillRect(z.x + 10, y - 10, 2, 5);\
                \}\
            \}\
\
            if (z.flash > 0) \{\
                ctx.globalCompositeOperation = 'xor'; \
                drawPixelSprite(sprite, z.x, y + yAdj, scale);\
                ctx.globalCompositeOperation = 'source-over';\
            \} else \{\
                drawPixelSprite(sprite, z.x, y + yAdj, scale);\
            \}\
        \});\
\
        // Droplets\
        s.droplets.forEach(proj => \{\
            if (proj.type === 'UV_BEAM') \{\
                // Beam Effect\
                ctx.fillStyle = '#FFF';\
                ctx.fillRect(proj.x, BOARD_OFFSET_Y + proj.r * CELL_SIZE + 28, 20, 2);\
                if (s.frame % 2 === 0) ctx.fillRect(proj.x - 10, BOARD_OFFSET_Y + proj.r * CELL_SIZE + 27, 40, 4); // Pulse\
            \} else \{\
                ctx.fillStyle = '#FFF';\
                ctx.fillRect(proj.x, BOARD_OFFSET_Y + proj.r * CELL_SIZE + 25, 6, 4);\
            \}\
        \});\
\
        // Particles\
        s.particles.forEach(p => \{\
            ctx.fillStyle = '#FFF';\
            ctx.fillRect(p.x, p.y, 3, 3);\
        \});\
\
        // Restore context\
        ctx.restore();\
\
        // UI (Static, not shaken)\
        ctx.font = '10px monospace';\
        ctx.fillStyle = '#FFF';\
        ctx.fillText('100', 60, 85);\
        ctx.fillText('75', 60, 145);\
        ctx.fillText('50', 60, 205);\
        ctx.fillText('150', 60, 265);\
        \
        // Hover\
        renderTooltip(ctx, s);\
    \};\
\
    const renderTooltip = (ctx: CanvasRenderingContext2D, s: any) => \{\
        let hoveredLabel = "";\
        let hoverX = 0;\
        let hoverY = 0;\
\
        const hoveredTool = s.tools.find((t: Tool) => \
            s.mouseX > BOARD_OFFSET_X + t.c * CELL_SIZE &&\
            s.mouseX < BOARD_OFFSET_X + (t.c + 1) * CELL_SIZE &&\
            s.mouseY > BOARD_OFFSET_Y + t.r * CELL_SIZE &&\
            s.mouseY < BOARD_OFFSET_Y + (t.r + 1) * CELL_SIZE\
        );\
        if (hoveredTool) \{\
            hoveredLabel = hoveredTool.type;\
            if (hoveredTool.type === 'UV_LAMP') hoveredLabel = "UV LAMP (Synergy!)";\
            hoverX = BOARD_OFFSET_X + hoveredTool.c * CELL_SIZE + 30;\
            hoverY = BOARD_OFFSET_Y + hoveredTool.r * CELL_SIZE;\
        \}\
\
        const hoveredPest = s.pests.find((p: Pest) => \
            Math.abs(s.mouseX - (p.x + 20)) < 25 &&\
            Math.abs(s.mouseY - (BOARD_OFFSET_Y + p.r * CELL_SIZE + 25)) < 25\
        );\
        if (hoveredPest) \{\
            hoveredLabel = `$\{hoveredPest.type\} $\{hoveredPest.status.wet ? '(WET)' : ''\}`;\
            hoverX = hoveredPest.x + 20;\
            hoverY = BOARD_OFFSET_Y + hoveredPest.r * CELL_SIZE;\
        \}\
\
        if (s.mouseX < BOARD_OFFSET_X) \{\
            if (s.mouseY > 50 && s.mouseY < 100) \{ hoveredLabel = "MISTER (Soaks Pests)"; hoverX = 60; hoverY = 70; \}\
            if (s.mouseY > 110 && s.mouseY < 160) \{ hoveredLabel = "UV LAMP (Crit vs Wet)"; hoverX = 60; hoverY = 130; \}\
            if (s.mouseY > 170 && s.mouseY < 220) \{ hoveredLabel = "STICKY TRAP"; hoverX = 60; hoverY = 190; \}\
            if (s.mouseY > 230 && s.mouseY < 280) \{ hoveredLabel = "VENUS FLYTRAP"; hoverX = 60; hoverY = 250; \}\
        \}\
\
        if (hoveredLabel) \{\
            ctx.font = '10px monospace';\
            ctx.fillStyle = '#000';\
            ctx.fillRect(hoverX, hoverY - 20, ctx.measureText(hoveredLabel).width + 8, 16);\
            ctx.fillStyle = '#FFF';\
            ctx.fillText(hoveredLabel, hoverX + 4, hoverY - 8);\
            ctx.strokeStyle = '#FFF';\
            ctx.strokeRect(hoverX, hoverY - 20, ctx.measureText(hoveredLabel).width + 8, 16);\
        \}\
    \};\
\
    const renderEndScreen = () => \{\
        const s = stateRef.current;\
        ctx.fillStyle = '#000';\
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);\
        ctx.fillStyle = '#FFF';\
        ctx.font = '30px monospace';\
        ctx.textAlign = 'center';\
\
        if (s.gameState === 'GAME_OVER') \{\
            ctx.fillText('GARDEN OVERRUN!', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 20);\
            ctx.font = '10px monospace';\
            ctx.fillText(`Failed at Wave $\{s.wave\}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 20);\
        \} else if (s.gameState === 'VICTORY') \{\
            ctx.fillText('MASTER BOTANIST!', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 20);\
            ctx.font = '10px monospace';\
            ctx.fillText(`The Slug King is defeated!`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 20);\
        \}\
        \
        ctx.fillStyle = '#888';\
        ctx.fillText('[ PRESS SPACE TO REPLANT ]', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 60);\
        ctx.textAlign = 'start'; \
    \};\
\
    const animId = requestAnimationFrame(loop);\
\
    canvas.addEventListener('mousedown', handleMouseDown);\
    canvas.addEventListener('mousemove', handleMouseMove);\
    canvas.addEventListener('touchstart', handleMouseDown);\
    window.addEventListener('keydown', handleKeyDown);\
\
    return () => \{\
        cancelAnimationFrame(animId);\
        canvas.removeEventListener('mousedown', handleMouseDown);\
        canvas.removeEventListener('mousemove', handleMouseMove);\
        canvas.removeEventListener('touchstart', handleMouseDown);\
        window.removeEventListener('keydown', handleKeyDown);\
    \};\
  \}, []);\
\
  return (\
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono select-none">\
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />\
      <div className="flex justify-between w-[800px] mb-2 px-4 pb-2 font-[family-name:Press_Start_2P]">\
         <div className="text-xl" style=\{\{ fontFamily: '"Press Start 2P", monospace' \}\}>LIGHT: \{lightUI\}</div>\
         <div className="text-xl" style=\{\{ fontFamily: '"Press Start 2P", monospace' \}\}>WAVE: \{waveUI\} / \{MAX_WAVES\}</div>\
      </div>\
      \
      <canvas \
        ref=\{canvasRef\}\
        width=\{CANVAS_WIDTH\}\
        height=\{CANVAS_HEIGHT\}\
        className="cursor-crosshair"\
      />\
      \
      <div className="mt-4 text-xs text-white font-mono">\
        \{isAuto ? \
            "[ AI BOTANIST ACTIVE - CLICK TO INTERVENE ]" : \
            "[ MANUAL: 1=Mist 2=UV 3=Trap 4=Flytrap ]"\
        \}\
      </div>\
    </div>\
  );\
\}}