import { motion } from 'framer-motion';

export function SwarmLoader() {
  // Create a grid of particles that pulse and move
  const particles = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    x: (i % 5) * 20,
    y: Math.floor(i / 5) * 20,
  }));

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
        {particles.map((particle, i) => (
          <motion.circle
            key={particle.id}
            cx={particle.x + 10}
            cy={particle.y + 10}
            r="2"
            fill="#000"
            initial={{ opacity: 0.2, scale: 0.8 }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.8, 1.2, 0.8],
              x: [0, Math.sin(i * 0.5) * 5, 0],
              y: [0, Math.cos(i * 0.5) * 5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.05,
            }}
          />
        ))}
        
        {/* Connection lines */}
        {particles.slice(0, 10).map((particle, i) => {
          const nextParticle = particles[(i + 5) % particles.length];
          return (
            <motion.line
              key={`line-${i}`}
              x1={particle.x + 10}
              y1={particle.y + 10}
              x2={nextParticle.x + 10}
              y2={nextParticle.y + 10}
              stroke="#000"
              strokeWidth="0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.1,
              }}
            />
          );
        })}
      </svg>
      
      {/* Center pulse */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-4 h-4 bg-black rounded-full" />
      </motion.div>
    </div>
  );
}
