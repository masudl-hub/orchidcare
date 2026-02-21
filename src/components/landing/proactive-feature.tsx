import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Snowflake, Calendar, Droplets } from "lucide-react";

const mono = "ui-monospace, monospace";

// --- GAME CONFIG & ASSETS ---
const GAME_SPEED = 3;
const GROUND_Y = 160; // Adjusted for shorter canvas
const PLAYER_X = 100;
const SCALE = 4;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;

type ObstacleType = 'CACTUS' | 'APHID' | 'CRACK';

interface Obstacle {
  x: number;
  type: ObstacleType;
  solved: boolean;
  width: number;
}

// Potted plant - neutral/running state (monochrome)
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
  "  11111   "
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
  "  11111   "
];

// Jumping plant - extends upward with leaves spread (monochrome)
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
  "  11111   "
];

// Wilting plant - droops down (monochrome)
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
  "  11111   "
];

const NOTIFICATIONS = [
  {
    id: "alert-1",
    time: "09:41 AM",
    title: "FROST WARNING",
    type: "CRITICAL",
    message: "Temp dropping to 30°F tonight. Bring the Monstera inside.",
    icon: <Snowflake size={14} />,
  },
  {
    id: "alert-2",
    time: "YESTERDAY",
    title: "SEASONAL SHIFT",
    type: "INFO",
    message: "Days are getting shorter. Reduce watering frequency.",
    icon: <Calendar size={14} />,
  },
  {
    id: "alert-3",
    time: "2 DAYS AGO",
    title: "CHECK-IN",
    type: "ROUTINE",
    message: "It's been 14 days since the last Fiddle Leaf soak. Time for a drink?",
    icon: <Droplets size={14} />,
  },
];

function FeatureDescription({
  visible,
}: {
  visible: boolean;
}) {
  const revealStyle = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: "all 600ms ease-out",
    transitionDelay: visible ? `${delay}ms` : "0ms",
  });

  return (
    <div className="flex flex-col transition-opacity duration-500 max-w-[440px]">
      {/* Heading */}
      <h2
        className="text-[22px] md:text-[32px]"
        style={{
          ...revealStyle(0),
          fontFamily: '"Press Start 2P", cursive',
          lineHeight: 1.4,
          color: "white",
        }}
      >
        Proactive<br />
        Intelligence
      </h2>

      {/* Tagline */}
      <p
        style={{
          ...revealStyle(150),
          fontFamily: mono,
          fontSize: "15px",
          color: "rgba(255,255,255,0.5)",
          marginTop: 20,
          fontStyle: "italic",
        }}
      >
        We think ahead so you don't have to.
      </p>

      {/* Body */}
      <p
        style={{
          ...revealStyle(300),
          fontFamily: mono,
          fontSize: "13px",
          color: "rgba(255,255,255,0.7)",
          lineHeight: 1.8,
          marginTop: 24,
          maxWidth: 400,
        }}
      >
        Orchid monitors local weather, season changes, and your care history to send alerts before problems start.
      </p>
    </div>
  );
}

function NotificationCard({
  item,
  index,
  visible,
}: {
  item: typeof NOTIFICATIONS[0];
  index: number;
  visible: boolean;
}) {
  const isCritical = item.type === "CRITICAL";

  return (
    <div
      className="w-full relative group transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(40px)",
        transitionDelay: `${index * 150 + 200}ms`,
        marginBottom: 16,
      }}
    >
        {/* Card Container */}
        <div 
            className="w-full p-4 relative overflow-hidden"
            style={{
                backgroundColor: isCritical 
                    ? "rgba(255, 255, 255, 0.06)" 
                    : "rgba(255, 255, 255, 0.03)",
                border: isCritical 
                    ? "1px solid rgba(255, 255, 255, 0.4)" 
                    : "1px solid rgba(255, 255, 255, 0.1)",
                boxShadow: isCritical 
                    ? "0 4px 20px rgba(255, 255, 255, 0.08)" 
                    : "none"
            }}
        >
            {/* Header Line */}
            <div className="flex justify-between items-start mb-3 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                     <span 
                        className="text-[10px] uppercase font-bold tracking-wider"
                        style={{ 
                            fontFamily: mono,
                            color: isCritical ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"
                        }}
                    >
                        [{item.type}]
                    </span>
                    <span style={{ 
                        color: isCritical ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"
                    }}>
                        {item.icon}
                    </span>
                </div>
                <span 
                    className="text-[10px] opacity-40"
                    style={{ fontFamily: mono }}
                >
                    {item.time}
                </span>
            </div>

            {/* Content */}
            <div>
                 <h4 
                    className="text-sm font-bold mb-1 text-white uppercase tracking-wide"
                    style={{ fontFamily: mono, letterSpacing: "0.05em" }}
                >
                    {item.title}
                </h4>
                <p 
                    className="text-[12px] leading-relaxed text-white/70"
                    style={{ fontFamily: mono }}
                >
                    {item.message}
                </p>
            </div>

            {/* Scanline/Active Indicator for Critical */}
            {isCritical && (
                <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: "linear-gradient(transparent 50%, rgba(255,255,255,0.04) 50%)",
                        backgroundSize: "100% 4px",
                        opacity: 0.8
                    }}
                />
            )}
        </div>
    </div>
  );
}

function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAuto, setIsAuto] = useState(true); // React state for UI feedback
  const isAutoRef = useRef(true); // Mutable ref for game loop
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Resize canvas to full width
    const handleResize = () => {
        canvas.width = window.innerWidth;
        // Keep height fixed or proportional? User asked for 100vw simulation.
        // Assuming height stays 300 as previously requested/defined in JSX.
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Ensure canvas has focus for keys to work immediately
    // canvas.focus(); // Removed auto-focus to avoid stealing scroll focus

    // --- GAME STATE ---
    let frame = 0;
    let animationId: number;
    // --- INPUT FIX: Explicitly type obstacles array ---
    let obstacles: Obstacle[] = [];
    let jumpBuffer = 0; // INPUT FIX: Remembers jump press for a few frames
    let duckTimer = 0; // Timer for ducking duration
    
    // Inputs
    const keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowRight: false,
      Space: false
    };

    const player = {
      y: GROUND_Y,
      vy: 0,
      gravity: GRAVITY,
      jumpForce: JUMP_FORCE,
      isGrounded: true,
      state: 'RUNNING' as 'RUNNING' | 'JUMPING' | 'DUCKING' | 'BUILDING',
      actionTimer: 0 
    };

    // --- INPUT HANDLING ---
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture keys if canvas is focused or active
      if (document.activeElement !== canvas) return;

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowRight'].includes(e.code)) {
        e.preventDefault(); // INPUT FIX: Prevents browser scrolling lag

        // Switch to manual mode on input
        if (isAutoRef.current) {
            isAutoRef.current = false;
            setIsAuto(false);
            player.state = 'RUNNING'; 
        }
        
        if (e.code === 'ArrowDown') keys.ArrowDown = true;
        if (e.code === 'ArrowRight') keys.ArrowRight = true;
        
        // INPUT FIX: Buffer the jump command.
        // If player is slightly in the air when pressing, we jump immediately upon landing.
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            jumpBuffer = 12; // Valid for ~200ms (12 frames)
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
       if (e.code === 'ArrowDown') keys.ArrowDown = false;
       if (e.code === 'ArrowRight') keys.ArrowRight = false;
    };

    const handleTouchStart = (e: Event) => {
        // Prevent default to stop double-firing on some touch devices
        // but allow focus
        if (e.type === 'touchstart') e.preventDefault();
        
        canvas.focus();

        if (isAutoRef.current) {
            isAutoRef.current = false;
            setIsAuto(false);
        }
        // Touch always triggers jump buffer
        jumpBuffer = 12;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleTouchStart);
    canvas.addEventListener('touchstart', handleTouchStart);


    // --- HELPER FUNCTIONS ---

    const resetGame = () => {
        obstacles = [];
        frame = 0;
        player.y = GROUND_Y;
        player.vy = 0;
        player.state = 'RUNNING';
        isAutoRef.current = true;
        setIsAuto(true);
        jumpBuffer = 0;
        duckTimer = 0;
    };

    const spawnObstacle = () => {
      if (frame % 250 === 0) {
        const r = Math.random();
        let type: ObstacleType = 'CACTUS';
        if (r < 0.33) type = 'CACTUS';
        else if (r < 0.66) type = 'APHID';
        else type = 'CRACK';

        obstacles.push({
          x: canvas.width + 50,
          type,
          solved: false,
          width: 30
        });
      }
    };

    const drawPixelSprite = (sprite: string[], x: number, y: number) => {
      for (let r = 0; r < sprite.length; r++) {
        for (let c = 0; c < sprite[r].length; c++) {
          if (sprite[r][c] === '1') {
            ctx.fillStyle = '#FFF';
            ctx.fillRect(x + c * SCALE, y + r * SCALE, SCALE, SCALE);
          }
        }
      }
    };

    const checkCollisions = () => {
        // Simple AABB collision
        const pLeft = PLAYER_X + 10;
        const pRight = PLAYER_X + 30;
        const pTop = player.y - 35;
        const pBottom = player.y;

        const hitTop = player.state === 'DUCKING' ? player.y - 20 : pTop;

        for (const obs of obstacles) {
            let oLeft = obs.x;
            let oRight = obs.x + 30;
            let oTop = GROUND_Y - 40;
            let oBottom = GROUND_Y;

            if (obs.type === 'APHID') {
                oTop = GROUND_Y - 55;
                oBottom = GROUND_Y - 30;
            } else if (obs.type === 'CRACK') {
                oTop = GROUND_Y - 10; 
            }

            if (obs.type !== 'CRACK') {
                if (pRight > oLeft && pLeft < oRight && pBottom > oTop && hitTop < oBottom) {
                    resetGame();
                }
            } else {
                if (pRight > oLeft && pLeft < oRight && player.y >= GROUND_Y - 5) {
                   if (!obs.solved) resetGame();
                }
            }
        }
    };

    const runAI = () => {
      if (!isAutoRef.current) return; 

      const scanDist = 250;
      obstacles.forEach(obs => {
        const dist = obs.x - PLAYER_X;
        if (dist > 0 && dist < scanDist && !obs.solved) {
          
          // AI Visuals
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

          // AI Logic
          if (obs.type === 'CACTUS' && dist < 90) {
            jumpBuffer = 5; // Always set jump buffer, will execute when grounded
            obs.solved = true;
          }
          else if (obs.type === 'APHID' && dist < 100) {
            if (player.isGrounded) {
              player.state = 'DUCKING';
              duckTimer = Math.ceil(dist / GAME_SPEED) + 15;
              obs.solved = true;
            }
          }
          else if (obs.type === 'CRACK' && dist < 110) {
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

      // 1. Manual Inputs
      if (!isAutoRef.current) {
        if (keys.ArrowDown) {
            player.state = 'DUCKING';
        } else if (keys.ArrowRight) {
            player.state = 'BUILDING';
            // Manual Build Logic
            obstacles.forEach(o => {
                if (o.type === 'CRACK' && o.x > PLAYER_X - 50 && o.x < PLAYER_X + 300) {
                    o.solved = true;
                }
            });
        } else if (!player.isGrounded) {
            player.state = 'JUMPING';
        } else {
            player.state = 'RUNNING';
        }
      }

      // 2. Physics & Jump Execution
      // If we have a buffered jump request AND we are on the ground, JUMP!
      if (jumpBuffer > 0 && player.isGrounded) {
          player.vy = player.jumpForce;
          player.isGrounded = false;
          player.state = 'JUMPING';
          jumpBuffer = 0; // Use up the jump command
      }
      
      // Decay jump buffer
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
        if (player.actionTimer === 0 && player.isGrounded) {
          player.state = 'RUNNING';
        }
      }

      // Duck timer for automatic standing up after ducking
      if (duckTimer > 0) {
        duckTimer--;
        if (duckTimer === 0) {
          player.state = 'RUNNING';
        }
      }

      // 3. Obstacles & Collision
      spawnObstacle();
      obstacles.forEach(o => o.x -= GAME_SPEED);
      obstacles = obstacles.filter(o => o.x > -100); 
      checkCollisions();

      // 4. Render
      // Transparent background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Horizon
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(canvas.width, GROUND_Y);
      ctx.stroke();
      
      runAI(); 

      // Draw Obstacles (monochrome)
      ctx.fillStyle = '#FFF';
      obstacles.forEach(o => {
        if (o.type === 'CRACK') {
          if (o.solved) {
            // WATERED/HEALED - solid white line with growth
            ctx.fillStyle = '#FFF';
            ctx.fillRect(o.x, GROUND_Y - 2, 80, 4);
            ctx.fillStyle = '#888';
            [10, 30, 50, 70].forEach(off => ctx.fillRect(o.x + off, GROUND_Y - 2, 5, 4));
          } else {
            // DRY CRACK - jagged white crack
            ctx.fillStyle = '#FFF'; 
            ctx.fillRect(o.x + 5, GROUND_Y - 2, 3, 20);
            ctx.fillRect(o.x + 15, GROUND_Y - 5, 3, 15);
            ctx.fillRect(o.x + 25, GROUND_Y - 3, 3, 18);
            ctx.fillRect(o.x + 35, GROUND_Y - 6, 3, 16);
            ctx.fillRect(o.x + 45, GROUND_Y - 4, 3, 20);
          }
        } 
        else if (o.type === 'CACTUS') {
            // Cactus with flower bloom
            ctx.fillStyle = '#FFF';
            ctx.fillRect(o.x + 10, GROUND_Y - 40, 10, 40); // Main body
            ctx.fillRect(o.x, GROUND_Y - 30, 10, 5); // Left arm
            ctx.fillRect(o.x, GROUND_Y - 30, 5, -10); // Left arm up
            ctx.fillRect(o.x + 20, GROUND_Y - 25, 10, 5); // Right arm
            ctx.fillRect(o.x + 25, GROUND_Y - 25, 5, -10); // Right arm up
            // Flower bloom (brighter)
            ctx.fillRect(o.x + 10, GROUND_Y - 45, 4, 4);
            ctx.fillRect(o.x + 16, GROUND_Y - 45, 4, 4);
            ctx.fillRect(o.x + 13, GROUND_Y - 48, 4, 4);
            ctx.fillRect(o.x + 13, GROUND_Y - 42, 4, 4);
        }
        else if (o.type === 'APHID') {
            // Flying pest
            const yPos = GROUND_Y - 55;
            const wingOffset = (Math.floor(frame / 10) % 2 === 0) ? -2 : 2;
            ctx.fillStyle = '#FFF';
            ctx.fillRect(o.x + 5, yPos, 10, 6); // Body
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; // Semi-transparent wings
            ctx.fillRect(o.x + 2, yPos + wingOffset, 6, 3); // Left wing
            ctx.fillRect(o.x + 14, yPos + wingOffset, 6, 3); // Right wing
            ctx.fillStyle = '#FFF'; 
            ctx.fillRect(o.x + 13, yPos + 1, 4, 4); // Head
        }
      });

      // Draw Player (potted plant)
      let sprite = PLANT_GROW_1;
      if (player.state === 'DUCKING') {
        sprite = PLANT_WILT;
      } else if (player.isGrounded) {
        sprite = (Math.floor(frame / 10) % 2 === 0) ? PLANT_GROW_1 : PLANT_GROW_2;
      } else {
        sprite = PLANT_JUMP;
      }
      
      const drawY = player.y - 40; 
      drawPixelSprite(sprite, PLAYER_X, drawY);

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
    <div className="w-screen flex flex-col items-center relative">
      <div className="relative border-b-2 border-white/20 w-screen max-w-[100vw] overflow-hidden bg-black/50 backdrop-blur-sm">
        <canvas 
          ref={canvasRef} 
          height={200}
          tabIndex={0}
          className="rendering-pixelated cursor-pointer outline-none w-screen max-w-[100vw] h-[200px] block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>{/* Status text */}
      <div className="absolute bottom-4 left-4 text-[10px] text-zinc-500 font-mono tracking-wide uppercase pointer-events-none">
        {isAuto ? 
            "[ CLICK TO ENGAGE MANUAL OVERRIDE ]" : 
            "[ MANUAL: SPACE=JUMP | DOWN=WILT | RIGHT=WATER ]"
        }
      </div>
    </div>
  );
}

export function ProactiveFeature({
  className = "",
  scrollRoot,
}: {
  className?: string;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.3, root: scrollRoot?.current ?? null }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <section
      ref={sectionRef}
      className={`snap-start w-full min-h-screen flex flex-col justify-center bg-black relative overflow-hidden ${className}`}
    >
      {/* Figure annotation label */}
      <div
        className="absolute transition-all duration-600 ease-out"
        style={{
          top: 40,
          right: 40,
          opacity: visible ? 0.35 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transitionDelay: visible ? "100ms" : "0ms",
          fontFamily: mono,
          fontSize: "11px",
          color: "white",
          letterSpacing: "0.12em",
          zIndex: 10,
        }}
      >
        FIG 2.4 — PREDICTIVE ALERTS
      </div>

      <div className="w-full px-4 md:px-16 lg:px-24 z-10 relative pointer-events-none">
        <div className="flex flex-col md:flex-row items-center gap-8 lg:gap-16 max-w-[1100px] mx-auto pointer-events-auto">
            
           {/* Left: Description — first on mobile */}
           <div className="flex flex-col flex-1 min-w-0 order-1 md:order-1 items-start">
             <FeatureDescription visible={visible} />
          </div>

          {/* Right: Interface (Notifications) — second on mobile */}
          <div className="flex-shrink-0 flex-1 min-w-0 max-w-[420px] order-2 md:order-2 self-center w-full">
            <div className="flex flex-col w-full">
                {NOTIFICATIONS.map((item, i) => (
                    <NotificationCard 
                        key={item.id} 
                        item={item} 
                        index={i} 
                        visible={visible} 
                    />
                ))}
            </div>
          </div>
          
        </div>
      </div>

      {/* Game Section - Added at Bottom */}
      <div className={`absolute bottom-0 w-full transition-all duration-1000 delay-500 ease-out flex justify-center z-20 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <DinoGame />
      </div>

    </section>
  );
}
