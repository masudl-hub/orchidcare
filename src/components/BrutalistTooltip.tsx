import { motion, AnimatePresence } from 'framer-motion';
import { useState, ReactNode } from 'react';

interface BrutalistTooltipProps {
  content: string;
  children: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function BrutalistTooltip({ content, children, disabled = false, fullWidth = false }: BrutalistTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div 
      className={fullWidth ? "relative block w-full" : "relative inline-block"}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          >
            <div className="bg-black border-2 border-black rounded-lg px-3 py-2 whitespace-nowrap">
              <p className="font-mono text-xs text-white uppercase tracking-wider">
                {content}
              </p>
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[2px]">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
