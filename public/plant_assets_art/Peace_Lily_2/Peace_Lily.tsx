import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const Peace_Lily = ({ mode = 'color' }: { mode?: 'color' | 'light' | 'dark' }) => {
  const [hover, setHover] = useState(false);
  const pixelSrc = mode === 'light' ? "/plants/Peace_Lily/Peace_Lily_pixel_bw_light.png" : mode === 'dark' ? "/plants/Peace_Lily/Peace_Lily_pixel_bw_dark.png" : "/plants/Peace_Lily/Peace_Lily_pixel_color.png";
  return (
    <div className="relative w-64 h-64 cursor-pointer group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.img src="/plants/Peace_Lily/Peace_Lily_base.png" className="absolute inset-0 w-full h-full object-cover z-10" animate={{ opacity: hover ? 0 : 1 }} />
      <img src={pixelSrc} className="absolute inset-0 w-full h-full object-cover z-0 rendering-pixelated" alt="Peace_Lily pixelated" />
    </div>
  );
};