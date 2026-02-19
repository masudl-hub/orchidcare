import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const jade_plant = ({ mode = 'color' }: { mode?: 'color' | 'light' | 'dark' }) => {
  const [hover, setHover] = useState(false);
  const pixelSrc = mode === 'light' ? "/plants/jade_plant/jade_plant_pixel_bw_light.png" : mode === 'dark' ? "/plants/jade_plant/jade_plant_pixel_bw_dark.png" : "/plants/jade_plant/jade_plant_pixel_color.png";
  return (
    <div className="relative w-64 h-64 cursor-pointer group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.img src="/plants/jade_plant/jade_plant_base.png" className="absolute inset-0 w-full h-full object-cover z-10" animate={{ opacity: hover ? 0 : 1 }} />
      <img src={pixelSrc} className="absolute inset-0 w-full h-full object-cover z-0 rendering-pixelated" alt="jade_plant pixelated" />
    </div>
  );
};