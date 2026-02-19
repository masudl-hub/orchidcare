import React from 'react';
import { motion } from 'framer-motion';

interface ChatResponseProps {
  text: string;
}

export function ChatResponse({ text }: ChatResponseProps) {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '12px',
        lineHeight: '1.6',
        color: 'rgba(255,255,255,0.7)',
      }}
    >
      {text}
    </motion.div>
  );
}
