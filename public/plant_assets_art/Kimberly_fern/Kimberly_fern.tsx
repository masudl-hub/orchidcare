import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const Kimberly_fern = ({ mode = 'color' }: { mode?: 'color' | 'light' | 'dark' }) => {
  const [hover, setHover] = useState(false);
  const pixelSrc = mode === 'light' ? "/plants/Kimberly_fern/Kimberly_fern_pixel_bw_light.png" : mode === 'dark' ? "/plants/Kimberly_fern/Kimberly_fern_pixel_bw_dark.png" : "/plants/Kimberly_fern/Kimberly_fern_pixel_color.png";
  return (
    <div className="relative w-64 h-64 cursor-pointer group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.img src="/plants/Kimberly_fern/Kimberly_fern_base.png" className="absolute inset-0 w-full h-full object-cover z-10" animate={{ opacity: hover ? 0 : 1 }} />
      <img src={pixelSrc} className="absolute inset-0 w-full h-full object-cover z-0 rendering-pixelated" alt="Kimberly_fern pixelated" />
    </div>
  );
};