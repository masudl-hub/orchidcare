import { motion } from 'framer-motion';

interface BotanicalLeafProps {
  className?: string;
  type?: 'fern' | 'monstera' | 'palm' | 'simple';
  animate?: boolean;
}

export function BotanicalLeaf({ className = '', type = 'fern', animate = true }: BotanicalLeafProps) {
  const animations = animate
    ? {
        initial: { opacity: 0, scale: 0.9, rotate: -5 },
        animate: { opacity: 0.6, scale: 1, rotate: 0 },
        transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      }
    : {};

  if (type === 'fern') {
    return (
      <motion.svg
        {...animations}
        className={className}
        viewBox="0 0 200 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 10 L100 290 M100 30 Q85 35 75 40 M100 30 Q115 35 125 40 M100 50 Q80 58 65 65 M100 50 Q120 58 135 65 M100 70 Q75 80 55 90 M100 70 Q125 80 145 90 M100 90 Q70 102 45 115 M100 90 Q130 102 155 115 M100 110 Q65 124 35 140 M100 110 Q135 124 165 140 M100 130 Q60 146 25 165 M100 130 Q140 146 175 165 M100 150 Q55 168 20 190 M100 150 Q145 168 180 190 M100 170 Q50 190 15 215 M100 170 Q150 190 185 215 M100 190 Q45 212 10 240 M100 190 Q155 212 190 240 M100 210 Q55 230 25 255 M100 210 Q145 230 175 255 M100 230 Q65 246 40 265 M100 230 Q135 246 160 265 M100 250 Q75 262 55 275 M100 250 Q125 262 145 275 M100 270 Q85 278 75 285 M100 270 Q115 278 125 285"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
      </motion.svg>
    );
  }

  if (type === 'monstera') {
    return (
      <motion.svg
        {...animations}
        className={className}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 180 C100 180 60 160 50 120 C40 80 60 40 100 20 C140 40 160 80 150 120 C140 160 100 180 100 180 M100 180 L100 50 M70 100 L130 100 M80 130 L120 130 M85 70 L115 70"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="currentColor"
          fillOpacity="0.1"
        />
      </motion.svg>
    );
  }

  if (type === 'palm') {
    return (
      <motion.svg
        {...animations}
        className={className}
        viewBox="0 0 200 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 240 L100 120 M100 120 Q70 80 50 40 M100 120 Q130 80 150 40 M100 120 Q60 95 30 70 M100 120 Q140 95 170 70 M100 120 Q55 110 20 100 M100 120 Q145 110 180 100"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </motion.svg>
    );
  }

  return (
    <motion.svg
      {...animations}
      className={className}
      viewBox="0 0 100 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="50" cy="50" rx="30" ry="45" fill="currentColor" opacity="0.2" />
      <path d="M50 10 L50 140" stroke="currentColor" strokeWidth="2" />
    </motion.svg>
  );
}
