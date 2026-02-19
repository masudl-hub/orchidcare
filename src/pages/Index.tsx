import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Hero } from '@/components/landing/Hero';
import { Nav } from '@/components/landing/Nav';
import { FeatureBento } from '@/components/landing/FeatureBento';
import { EtchingPatterns } from '@/components/landing/BrutalistPatterns';
// DemoChatOverlay archived — replaced by /demo page (see DEMO_PAGE_SPEC.md)
import { Progress } from '@/components/ui/progress';

export default function Index() {
  const navigate = useNavigate();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isExpanding, setIsExpanding] = useState(false);
  const [showHero, setShowHero] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsExpanding(true), 100);
          setTimeout(() => setShowHero(true), 200);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleStartGrowing = () => {
    navigate('/begin');
  };

  const handleDemoClick = () => {
    setDemoOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-white overflow-x-hidden">
      <EtchingPatterns />
      
      {showContent && <Nav onLoginClick={handleLoginClick} onDemoClick={handleDemoClick} />}
      
      {/* Demo Chat Overlay — archived, replaced by /demo page */}
      
      <AnimatePresence>
        {!showHero && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            {!isExpanding ? (
              <div className="w-64 space-y-2">
                <div className="flex justify-between font-mono text-[10px] text-white/50">
                  <span>LOADING ORCHID</span>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
                <Progress value={loadingProgress} className="h-1 bg-white/10" />
              </div>
            ) : (
              <motion.div
                className="bg-black"
                initial={{ width: '1px', height: '1px' }}
                animate={{
                  width: '100vw',
                  height: '100vh',
                }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showHero && (
        <Hero onVideoEnd={() => setShowContent(true)} onTryItClick={handleDemoClick} />
      )}

      {showContent && (
        <FeatureBento onStartGrowing={handleStartGrowing} />
      )}
    </div>
  );
}
