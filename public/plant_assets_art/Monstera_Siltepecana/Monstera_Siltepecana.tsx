import React, { useState } from 'react';
import { motion } from 'framer-motion';

export const Monstera_Siltepecana = ({ mode = 'color' }: { mode?: 'color' | 'light' | 'dark' }) => {
  const [hover, setHover] = useState(false);
  const pixelSrc = mode === 'light' ? "/monstera/Monstera_Siltepecana/Monstera_Siltepecana_pixel_bw_light.png" : mode === 'dark' ? "/monstera/Monstera_Siltepecana/Monstera_Siltepecana_pixel_bw_dark.png" : "/monstera/Monstera_Siltepecana/Monstera_Siltepecana_pixel_color.png";
  return (
    <div className="relative w-64 h-64 cursor-pointer group" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.img src="/monstera/Monstera_Siltepecana/Monstera_Siltepecana_base.png" className="absolute inset-0 w-full h-full object-cover z-10" animate={{ opacity: hover ? 0 : 1 }} />
      <img src={pixelSrc} className="absolute inset-0 w-full h-full object-cover z-0 rendering-pixelated" alt="Monstera_Siltepecana pixelated" />
    </div>
  );
};