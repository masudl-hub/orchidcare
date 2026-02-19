import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const hand_trowel = ({ mode = 'color' }: { mode?: 'color' | 'light' | 'dark' }) => {
  const [hover, setHover] = useState(false);
  const pixelSrc = mode === 'light' ? "/monstera/hand_trowel/hand_trowel_pixel_bw_light.png" : mode === 'dark' ? "/monstera/hand_trowel/hand_trowel_pixel_bw_dark.png" : "/monstera/hand_trowel/hand_trowel_pixel_color.png";
  return (
    <div className="relative w-64 h-64 cursor-pointer group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.img src="/monstera/hand_trowel/hand_trowel_base.png" className="absolute inset-0 w-full h-full object-cover z-10" animate={{ opacity: hover ? 0 : 1 }} />
      <img src={pixelSrc} className="absolute inset-0 w-full h-full object-cover z-0 rendering-pixelated" alt="hand_trowel pixelated" />
    </div>
  );
};