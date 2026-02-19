import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const Alocasia_amazonica = ({ mode = 'color' }: { mode?: 'color' | 'light' | 'dark' }) => {
  const [hover, setHover] = useState(false);
  const pixelSrc = mode === 'light' ? "/plants/Alocasia_amazonica/Alocasia_amazonica_pixel_bw_light.png" : mode === 'dark' ? "/plants/Alocasia_amazonica/Alocasia_amazonica_pixel_bw_dark.png" : "/plants/Alocasia_amazonica/Alocasia_amazonica_pixel_color.png";
  return (
    <div className="relative w-64 h-64 cursor-pointer group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.img src="/plants/Alocasia_amazonica/Alocasia_amazonica_base.png" className="absolute inset-0 w-full h-full object-cover z-10" animate={{ opacity: hover ? 0 : 1 }} />
      <img src={pixelSrc} className="absolute inset-0 w-full h-full object-cover z-0 rendering-pixelated" alt="Alocasia_amazonica pixelated" />
    </div>
  );
};