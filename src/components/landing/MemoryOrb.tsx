import React, { useEffect, useRef, useState } from 'react';

/**
 * MemoryOrb - A holographic 3D wireframe sphere visualization
 * Inspired by Voice Coil physics simulations
 * Represents the interconnected memory system of Orchid
 */

// Density steps for decryption effect (solid → fine → resolved)
const DENSITY_STEPS = ["█", "▓", "▒", "░"];
const DECRYPT_CYCLES_PER_CHAR = 4; // How many cycles before resolving

function decryptChar(cycleCount: number, targetChar: string): string {
  if (targetChar === ' ') return ' '; // Spaces always pass through
  if (cycleCount >= DENSITY_STEPS.length) return targetChar;
  return DENSITY_STEPS[Math.min(cycleCount, DENSITY_STEPS.length - 1)];
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface MemoryNode {
  label: string;
  lat: number;  // Latitude position on sphere (-PI/2 to PI/2)
  long: number; // Longitude position on sphere (0 to 2*PI)
  birthTime?: number; // When the node was added (for animation)
  id?: string; // Unique identifier for the node
  decryptProgress?: number[]; // Per-character decryption cycle count
}

// Base memory nodes positioned on the sphere surface
const baseMemoryNodes: MemoryNode[] = [
  { label: 'has cat', lat: 0.8, long: 0.5, id: 'base-0', decryptProgress: [4, 4, 4, 4, 4, 4, 4] },
  { label: 'underwaters', lat: 0.3, long: 1.8, id: 'base-1', decryptProgress: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { label: 'based in seattle', lat: -0.2, long: 3.2, id: 'base-2', decryptProgress: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { label: 'travels often', lat: -0.6, long: 4.5, id: 'base-3', decryptProgress: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { label: 'battled spider mites', lat: 0.5, long: 5.5, id: 'base-4', decryptProgress: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { label: 'prefers brief messages', lat: -0.4, long: 0.8, id: 'base-5', decryptProgress: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
];

// Pool of additional memories that can pop up
const memoryPool: Omit<MemoryNode, 'birthTime' | 'id'>[] = [
  { label: 'loves succulents', lat: 0.6, long: 2.3 },
  { label: 'night shift worker', lat: -0.5, long: 1.2 },
  { label: 'low-light apartment', lat: 0.4, long: 4.0 },
  { label: 'forgets to fertilize', lat: -0.7, long: 5.0 },
  { label: 'bought monstera 2024', lat: 0.2, long: 0.3 },
  { label: 'prefers tropical plants', lat: -0.3, long: 2.8 },
  { label: 'killed 3 fiddle leafs', lat: 0.7, long: 3.5 },
  { label: 'learning propagation', lat: -0.1, long: 5.8 },
  { label: 'humidity: 45%', lat: 0.45, long: 1.0 },
  { label: 'south-facing window', lat: -0.55, long: 3.8 },
];

// Calculate spherical distance between two lat/long points
const sphericalDistance = (lat1: number, long1: number, lat2: number, long2: number): number => {
  // Haversine formula adapted for unit sphere
  const dLat = lat2 - lat1;
  const dLong = long2 - long1;
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLong / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(a));
};

// Find a position that doesn't overlap with existing nodes
const findNonOverlappingPosition = (existingNodes: MemoryNode[], attempts: number = 20): { lat: number; long: number } => {
  const MIN_DISTANCE = 0.8; // Minimum angular distance between nodes
  
  for (let i = 0; i < attempts; i++) {
    const lat = (Math.random() - 0.5) * Math.PI * 0.9; // -0.45π to 0.45π (avoid poles)
    const long = Math.random() * Math.PI * 2;
    
    // Check if this position is far enough from all existing nodes
    const isTooClose = existingNodes.some(node => 
      sphericalDistance(lat, long, node.lat, node.long) < MIN_DISTANCE
    );
    
    if (!isTooClose) {
      return { lat, long };
    }
  }
  
  // Fallback: return random position anyway (rare case where sphere is very crowded)
  return {
    lat: (Math.random() - 0.5) * Math.PI * 0.9,
    long: Math.random() * Math.PI * 2
  };
};

// 3D Math Utilities
const rotateX = (p: Point3D, angle: number): Point3D => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: p.x,
    y: p.y * cos - p.z * sin,
    z: p.y * sin + p.z * cos,
  };
};

const rotateY = (p: Point3D, angle: number): Point3D => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: p.x * cos + p.z * sin,
    y: p.y,
    z: -p.x * sin + p.z * cos,
  };
};

const project = (
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  focalLength: number
): { x: number; y: number; scale: number } => {
  const scale = focalLength / (focalLength + z);
  return {
    x: x * scale + width / 2,
    y: y * scale + height / 2,
    scale,
  };
};

const map = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

export const MemoryOrb: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const isHovering = useRef(false);
  const nodesRef = useRef<MemoryNode[]>([...baseMemoryNodes]);
  const poolIndexRef = useRef(0);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Node spawning configuration
    const SPAWN_INTERVAL = 1.5; // seconds between spawns
    const MAX_ACTIVE_NODES = 16; // Maximum nodes on screen at once

    const render = () => {
      // Handle High DPI Scaling
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // Update Time
      timeRef.current += 0.016; // ~60fps
      const t = timeRef.current;

      // Spawn new nodes periodically
      if (t - lastSpawnRef.current > SPAWN_INTERVAL && nodesRef.current.length < MAX_ACTIVE_NODES) {
        lastSpawnRef.current = t;
        
        const currentNodes = nodesRef.current;
        const memoryTemplate = memoryPool[poolIndexRef.current % memoryPool.length];
        
        // Find non-overlapping position
        const position = findNonOverlappingPosition(currentNodes);
        
        // Add new node with unique ID and decrypt state
        const newNode: MemoryNode = { 
          ...memoryTemplate,
          lat: position.lat,
          long: position.long,
          birthTime: t,
          id: `spawn-${poolIndexRef.current}`,
          decryptProgress: new Array(memoryTemplate.label.length).fill(0)
        };
        nodesRef.current = [...currentNodes, newNode];
        poolIndexRef.current++;
      }

      // Sphere Configuration
      const baseRadius = Math.min(width, height) * 0.25;
      const cx = width / 2;
      const cy = height / 2;
      const focalLength = 500;

      // Rotation - slow automatic rotation + mouse influence
      const mouseInfluence = isHovering.current ? 0.0015 : 0;
      const rotXAngle = t * 0.025 + (mouseRef.current.y - cy) * mouseInfluence;
      const rotYAngle = t * 0.0375 + (mouseRef.current.x - cx) * mouseInfluence;

      // Subtle breathing animation
      const breathe = 1 + Math.sin(t * 0.3) * 0.01;

      // Grid configuration
      const lats = 12;
      const longs = 18;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Get 3D point on sphere
      const getPoint = (lat: number, long: number, radius: number = baseRadius): Point3D => {
        const r = radius * breathe;
        return {
          x: Math.cos(lat) * Math.cos(long) * r,
          y: Math.sin(lat) * r,
          z: Math.cos(lat) * Math.sin(long) * r,
        };
      };

      // Transform and project a point
      const transformPoint = (p: Point3D) => {
        let rp = rotateX(p, rotXAngle);
        rp = rotateY(rp, rotYAngle);
        const proj = project(rp.x, rp.y, rp.z, width, height, focalLength);
        return { ...proj, z: rp.z };
      };

      // Store all renderable items for depth sorting
      const renderItems: Array<{
        type: 'line' | 'node';
        z: number;
        render: () => void;
      }> = [];

      // Generate wireframe segments
      for (let i = 0; i < lats; i++) {
        const lat1 = map(i, 0, lats, -Math.PI / 2, Math.PI / 2);
        const lat2 = map(i + 1, 0, lats, -Math.PI / 2, Math.PI / 2);

        for (let j = 0; j < longs; j++) {
          const long1 = map(j, 0, longs, 0, Math.PI * 2);
          const long2 = map(j + 1, 0, longs, 0, Math.PI * 2);

          const p1 = getPoint(lat1, long1);
          const p2 = getPoint(lat1, long2);
          const p3 = getPoint(lat2, long1);

          const tp1 = transformPoint(p1);
          const tp2 = transformPoint(p2);
          const tp3 = transformPoint(p3);

          // Latitude line
          const avgZ1 = (tp1.z + tp2.z) / 2;
          const alpha1 = map(avgZ1, -baseRadius, baseRadius, 0.7, 0.04);
          renderItems.push({
            type: 'line',
            z: avgZ1,
            render: () => {
              ctx.strokeStyle = `rgba(228, 228, 231, ${Math.max(0.04, Math.min(0.7, alpha1))})`;
              ctx.lineWidth = alpha1 > 0.35 ? 0.8 : 0.5;
              ctx.beginPath();
              ctx.moveTo(tp1.x, tp1.y);
              ctx.lineTo(tp2.x, tp2.y);
              ctx.stroke();
            },
          });

          // Longitude line
          const avgZ2 = (tp1.z + tp3.z) / 2;
          const alpha2 = map(avgZ2, -baseRadius, baseRadius, 0.7, 0.04);
          renderItems.push({
            type: 'line',
            z: avgZ2,
            render: () => {
              ctx.strokeStyle = `rgba(228, 228, 231, ${Math.max(0.04, Math.min(0.7, alpha2))})`;
              ctx.lineWidth = alpha2 > 0.35 ? 0.8 : 0.5;
              ctx.beginPath();
              ctx.moveTo(tp1.x, tp1.y);
              ctx.lineTo(tp3.x, tp3.y);
              ctx.stroke();
            },
          });
        }
      }

      // Add memory nodes with labels
      const currentNodes = nodesRef.current;
      currentNodes.forEach((node, i) => {
        // Position on sphere surface
        const spherePoint = getPoint(node.lat, node.long);
        const tSphere = transformPoint(spherePoint);

        // Position for label (extended outward from sphere)
        const labelRadius = baseRadius * 1.6;
        const labelPoint = getPoint(node.lat, node.long, labelRadius);
        const tLabel = transformPoint(labelPoint);

        // Calculate spawn animation progress (0 to 1)
        const age = node.birthTime !== undefined ? t - node.birthTime : 10;
        const spawnProgress = Math.min(1, age / 0.8); // 0.8 second spawn animation
        const easeOut = 1 - Math.pow(1 - spawnProgress, 3); // Cubic ease-out
        
        // Scale factor for pop-in effect
        const spawnScale = 0.3 + easeOut * 0.7;
        
        // Decrypt animation - progress each character's cycle count
        if (node.decryptProgress && age < 1.2) {
          // Stagger character resolution based on position
          const DECRYPT_SPEED = 8; // Frames per cycle step (faster = lower number)
          const framesSinceBirth = age * 60; // Approx frames at 60fps
          
          for (let i = 0; i < node.decryptProgress.length; i++) {
            const charDelay = i * 1.5; // Stagger by 1.5 frames per character
            const charFrames = framesSinceBirth - charDelay;
            const targetCycles = Math.floor(charFrames / DECRYPT_SPEED);
            
            if (node.decryptProgress[i] < DENSITY_STEPS.length && targetCycles > node.decryptProgress[i]) {
              node.decryptProgress[i] = Math.min(DENSITY_STEPS.length, targetCycles);
            }
          }
        }
        
        // Build decrypted label text
        const displayLabel = node.decryptProgress
          ? node.label.split('').map((char, i) => 
              decryptChar(node.decryptProgress![i], char)
            ).join('')
          : node.label;
        
        // Extra glow for newly spawned nodes
        const isNew = age < 2;
        const newGlow = isNew ? 1 + Math.sin(age * 8) * 0.3 : 1;

        // Depth-based alpha
        const nodeAlpha = map(tSphere.z, -baseRadius, baseRadius * 0.5, 1, 0.15);
        const clampedAlpha = Math.max(0.15, Math.min(1, nodeAlpha)) * spawnProgress;

        // Only render if facing forward enough
        if (tSphere.z < baseRadius * 0.6) {
          renderItems.push({
            type: 'node',
            z: tSphere.z,
            render: () => {
              // Pulse effect
              const pulse = 0.6 + Math.sin(t * 1.2 + i * 1.1) * 0.25;

              // Draw connection line from sphere to label
              ctx.strokeStyle = `rgba(228, 228, 231, ${clampedAlpha * 0.35})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(tSphere.x, tSphere.y);
              ctx.lineTo(tLabel.x, tLabel.y);
              ctx.stroke();

              // Draw dot on sphere surface with glow
              const glowRadius = 6 * tSphere.scale * spawnScale * newGlow;
              const gradient = ctx.createRadialGradient(
                tSphere.x, tSphere.y, 0,
                tSphere.x, tSphere.y, glowRadius
              );
              
              // New nodes get a brighter, slightly green-tinted glow
              if (isNew) {
                gradient.addColorStop(0, `rgba(200, 255, 200, ${clampedAlpha * pulse * 0.8})`);
                gradient.addColorStop(0.5, `rgba(220, 255, 220, ${clampedAlpha * pulse * 0.3})`);
              } else {
                gradient.addColorStop(0, `rgba(255, 255, 255, ${clampedAlpha * pulse * 0.6})`);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${clampedAlpha * pulse * 0.2})`);
              }
              gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(tSphere.x, tSphere.y, glowRadius, 0, Math.PI * 2);
              ctx.fill();

              // Core dot on sphere
              ctx.fillStyle = isNew 
                ? `rgba(200, 255, 200, ${clampedAlpha})`
                : `rgba(255, 255, 255, ${clampedAlpha})`;
              ctx.beginPath();
              ctx.arc(tSphere.x, tSphere.y, 2.5 * tSphere.scale * spawnScale, 0, Math.PI * 2);
              ctx.fill();

              // Dot at label position
              ctx.fillStyle = isNew
                ? `rgba(200, 255, 200, ${clampedAlpha * pulse})`
                : `rgba(255, 255, 255, ${clampedAlpha * pulse})`;
              ctx.beginPath();
              ctx.arc(tLabel.x, tLabel.y, 2 * tLabel.scale * spawnScale, 0, Math.PI * 2);
              ctx.fill();

              // Draw label text
              const fontSize = Math.max(10, 12 * tLabel.scale) * spawnScale;
              ctx.font = `${fontSize}px "Jersey 25", ui-monospace, monospace`;
              ctx.fillStyle = isNew
                ? `rgba(200, 255, 200, ${clampedAlpha * (0.6 + pulse * 0.3)})`
                : `rgba(228, 228, 231, ${clampedAlpha * (0.6 + pulse * 0.3)})`;
              
              // Determine text position based on which side of center
              const textOffset = 8 * tLabel.scale;
              if (tLabel.x > cx) {
                ctx.textAlign = 'left';
                ctx.fillText(displayLabel, tLabel.x + textOffset, tLabel.y + 3);
              } else {
                ctx.textAlign = 'right';
                ctx.fillText(displayLabel, tLabel.x - textOffset, tLabel.y + 3);
              }
            },
          });
        }
      });

      // Sort by depth (back to front) and render
      renderItems.sort((a, b) => b.z - a.z);
      renderItems.forEach(item => item.render());

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseEnter = () => {
    isHovering.current = true;
  };

  const handleMouseLeave = () => {
    isHovering.current = false;
    mouseRef.current = { x: 0, y: 0 };
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="w-full h-full block"
      style={{ touchAction: 'none' }}
    />
  );
};

export default MemoryOrb;
