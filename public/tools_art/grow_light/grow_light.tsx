import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const grow_light = ({ mode = 'color' }: { mode?: 'color' | 'light' | 'dark' }) => {
  const [hover, setHover] = useState(false);
  const pixelSrc = mode === 'light' ? "/monstera/grow_light/grow_light_pixel_bw_light.png" : mode === 'dark' ? "/monstera/grow_light/grow_light_pixel_bw_dark.png" : "/monstera/grow_light/grow_light_pixel_color.png";
  return (
    <div className="relative w-64 h-64 cursor-pointer group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.img src="/monstera/grow_light/grow_light_base.png" className="absolute inset-0 w-full h-full object-cover z-10" animate={{ opacity: hover ? 0 : 1 }} />
      <img src={pixelSrc} className="absolute inset-0 w-full h-full object-cover z-0 rendering-pixelated" alt="grow_light pixelated" />
    </div>
  );
};