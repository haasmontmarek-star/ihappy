import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip = ({ content, children }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-block" 
      onMouseEnter={() => setIsVisible(true)} 
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 px-3 py-2 text-[10px] md:text-xs font-medium text-white bg-zinc-900 rounded-lg shadow-xl -top-2 left-1/2 -translate-x-1/2 -translate-y-full w-48 md:w-auto md:max-w-xs text-center"
          >
            {content}
            <div className="absolute w-2 h-2 bg-zinc-900 rotate-45 left-1/2 -translate-x-1/2 -bottom-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
