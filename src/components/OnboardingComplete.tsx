import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const PIXEL_ASSETS = [
  '/plant_assets_art/Alocasia_amazonica/Alocasia_amazonica_pixel_bw_light.png',
  '/plant_assets_art/Aloe_Vera/Aloe_Vera_pixel_bw_light.png',
  '/plant_assets_art/burros_tail/burros_tail_pixel_bw_light.png',
  '/plant_assets_art/Chinese_Money_Plant/Chinese_Money_Plant_pixel_bw_light.png',
  '/plant_assets_art/Rubber_Plant/Rubber_Plant_pixel_bw_light.png',
  '/plant_assets_art/Polka_Dot_Begonia/Polka_Dot_Begonia_pixel_bw_light.png',
  '/plant_assets_art/Peace_Lily/Peace_Lily_pixel_bw_light.png',
  '/tools_art/atomizer/atomizer_pixel_bw_light.png',
  '/tools_art/bag_of_soil/bag_of_soil_pixel_bw_light.png',
  '/tools_art/wicker_basket/wicker_basket_pixel_bw_light.png',
  '/tools_art/hand_trowel/hand_trowel_pixel_bw_light.png',
  '/tools_art/pruning_shears/pruning_shears_pixel_bw_light.png',
  '/tools_art/gardening_gloves/gardening_gloves_pixel_bw_light.png',
];

interface OnboardingCompleteProps {
  onComplete: () => void;
}

const tips = [
  'Send a photo of any plant for instant identification',
  'Ask about care instructions for your specific environment',
  'Get help diagnosing plant problems with visual guides',
  'Find local nurseries and plant shops near you',
  'Set reminders for watering and fertilizing',
  'Learn about plants toxic to your pets',
];

const examplePrompts = [
  '"What\'s this plant?" + photo',
  '"Why are my monstera leaves turning yellow?"',
  '"Best low-light plants for my apartment"',
  '"Is this safe for my cat?"',
  '"When should I repot my snake plant?"',
  '"Local shops that sell succulents"',
];

export function OnboardingComplete({ onComplete }: OnboardingCompleteProps) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isExpanding, setIsExpanding] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);
  const [showMessage, setShowMessage] = useState(false);
  const [replacedIndex, setReplacedIndex] = useState<number | null>(null);
  const [currentAsset, setCurrentAsset] = useState<string>('');

  useEffect(() => {
    const chars = ['/', 'R', 'E', 'A', 'D', 'Y'];
    let timeoutId: any;
    
    if (showTips) {
      const triggerRandomChange = () => {
        const randomIndex = Math.floor(Math.random() * chars.length);
        const randomAsset = PIXEL_ASSETS[Math.floor(Math.random() * PIXEL_ASSETS.length)];
        
        setReplacedIndex(randomIndex);
        setCurrentAsset(randomAsset);
        
        setTimeout(() => {
          setReplacedIndex(null);
          timeoutId = setTimeout(triggerRandomChange, 1500 + Math.random() * 3000);
        }, 1000);
      };

      timeoutId = setTimeout(triggerRandomChange, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [showTips]);

  useEffect(() => {
    // Loading progress
    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsExpanding(true), 300);
          setTimeout(() => setShowTips(true), 1400);
          return 100;
        }
        return prev + 3;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showTips) {
      // Cycle through tips
      const tipInterval = setInterval(() => {
        setCurrentTip((prev) => {
          if (prev >= tips.length - 1) {
            clearInterval(tipInterval);
            setTimeout(() => setShowMessage(true), 1000);
            setTimeout(() => onComplete(), 7000); // 7s for final read
            return prev;
          }
          return prev + 1;
        });
      }, 3000); // Slower tip cycles

      return () => clearInterval(tipInterval);
    }
  }, [showTips, onComplete]);

  if (showTips) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-4 overflow-hidden">
        {/* Tips display */}
        <div className="max-w-4xl w-full space-y-12 px-8 md:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 style={{ fontFamily: '"Press Start 2P", cursive' }} className="text-4xl text-white mb-8 flex justify-center items-center h-16">
              {['/', 'R', 'E', 'A', 'D', 'Y'].map((char, i) => (
                <span key={i} className="relative inline-flex items-center justify-center min-w-[1.2ch] h-full">
                  <AnimatePresence mode="wait">
                    {replacedIndex === i ? (
                      <motion.img 
                        key={`asset-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        src={currentAsset} 
                        className="w-10 h-10 object-contain absolute" 
                      />
                    ) : (
                      <motion.span
                        key={`char-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        {char}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              ))}
            </h1>
          </motion.div>

          {/* Tips carousel */}
          <motion.div
            key={currentTip}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-black border border-white p-8"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500 mb-4">
              Tip {currentTip + 1} of {tips.length}
            </div>
            <p className="text-2xl font-mono text-white leading-relaxed">
              {tips[currentTip]}
            </p>
          </motion.div>

          {/* Example prompts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-50">
            {examplePrompts.slice(0, 4).map((prompt, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="border border-stone-800 px-4 py-3"
              >
                <p className="font-mono text-xs text-stone-400">
                  {prompt}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Welcome message */}
          {showMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black border border-white p-8"
            >
              <div className="flex items-start gap-6">
                <div style={{ fontFamily: '"Press Start 2P", cursive' }} className="w-12 h-12 border border-white flex items-center justify-center text-white text-xl flex-shrink-0">
                  V
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] text-stone-500 mb-2 uppercase tracking-widest">
                    Orchid • Just now
                  </div>
                  <p className="font-mono text-sm text-white leading-relaxed">
                    Welcome! I'm here to help with all your plant questions. Feel free to ask me anything or send a photo of a plant you'd like to identify.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      {!isExpanding ? (
        <div className="relative">
          <div className="flex flex-col items-center gap-6">
            <div className="w-64 h-1 border border-stone-800 bg-black">
              <motion.div
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${loadingProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-stone-500">
              CONFIGURING YOUR PROFILE // {loadingProgress}%
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          className="bg-black"
          initial={{ width: '16rem', height: '1px' }}
          animate={{
            width: '100vw',
            height: '100vh',
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
}
