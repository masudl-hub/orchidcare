import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface NavProps {
  onLoginClick?: () => void;
  onDemoClick?: () => void;
}

export function Nav({ onLoginClick, onDemoClick }: NavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      // Check if scrolled past hero section (approximately viewport height)
      const heroHeight = window.innerHeight;
      setIsScrolled(window.scrollY > heroHeight * 0.8);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLoginClick = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      navigate('/login');
    }
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-6"
    >
      <div className="max-w-7xl mx-auto">
        <motion.div
          animate={{
            justifyContent: 'flex-end'
          }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center"
        >
          <motion.div
            layout
            className="flex items-center gap-8"
          >
            <motion.button
              onClick={() => navigate('/proposal')}
              whileHover={{ scale: 1.05 }}
              animate={{
                color: isScrolled ? '#000000' : '#ffffff'
              }}
              transition={{ duration: 0.4 }}
              className="font-mono text-sm uppercase tracking-widest hover:opacity-70 transition-opacity"
            >
              549 Proposal
            </motion.button>
            <motion.button
              onClick={handleLoginClick}
              whileHover={{ scale: 1.05 }}
              animate={{
                color: isScrolled ? '#000000' : '#ffffff'
              }}
              transition={{ duration: 0.4 }}
              className="font-mono text-sm uppercase tracking-widest hover:opacity-70 transition-opacity"
            >
              Login
            </motion.button>
            <motion.button
              onClick={onDemoClick}
              whileHover={{ scale: 1.05 }}
              animate={{
                color: isScrolled ? '#000000' : '#ffffff'
              }}
              transition={{ duration: 0.4 }}
              className="font-mono text-sm uppercase tracking-widest hover:opacity-70 transition-opacity"
            >
              Demo
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </motion.nav>
  );
}