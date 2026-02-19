import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const Chinese_evergreen = ({ mode = 'color' }: { mode?: 'color' | 'light' | 'dark' }) => {
  const [hover, setHover] = useState(false);
  const pixelSrc = mode === 'light' ? "/plants/Chinese_evergreen/Chinese_evergreen_pixel_bw_light.png" : mode === 'dark' ? "/plants/Chinese_evergreen/Chinese_evergreen_pixel_bw_dark.png" : "/plants/Chinese_evergreen/Chinese_evergreen_pixel_color.png";
  return (
    <div className="relative w-64 h-64 cursor-pointer group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.img src="/plants/Chinese_evergreen/Chinese_evergreen_base.png" className="absolute inset-0 w-full h-full object-cover z-10" animate={{ opacity: hover ? 0 : 1 }} />
      <img src={pixelSrc} className="absolute inset-0 w-full h-full object-cover z-0 rendering-pixelated" alt="Chinese_evergreen pixelated" />
    </div>
  );
};