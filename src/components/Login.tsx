import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

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

interface LoginProps {
  onBack: () => void;
  onCreateAccount: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onAppleLogin?: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function Login({ 
  onBack, 
  onCreateAccount, 
  onLogin, 
  onGoogleLogin,
  onAppleLogin,
  isLoading = false,
  error = null 
}: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [replacedIndex, setReplacedIndex] = useState<number | null>(null);
  const [currentAsset, setCurrentAsset] = useState<string>('');

  useEffect(() => {
    const chars = ['/', 'L', 'O', 'G', 'I', 'N'];
    let timeoutId: any;
    
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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(email, password);
  };

  const handleGoogleLogin = async () => {
    await onGoogleLogin();
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Back button */}
      <button
        onClick={onBack}
        className="fixed top-8 left-8 md:left-16 text-white/40 hover:text-white/80 transition-colors duration-300 cursor-pointer z-30"
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: '14px', letterSpacing: 'normal' }}
      >
        &larr; back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10 px-8"
      >
        {/* Title */}
        <div className="text-center mb-8">
          <h1 style={{ fontFamily: '"Press Start 2P", cursive' }} className="text-4xl text-white mb-2 flex justify-center items-center h-16">
            {['/', 'L', 'O', 'G', 'I', 'N'].map((char, i) => (
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
                      className="w-14 h-14 object-contain absolute" 
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
          <p className="font-mono text-sm text-white">
            Access your botanical intelligence.
          </p>
        </div>

        {/* Login container */}
        <div className="bg-black border border-white p-8">
          {/* Social login */}
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 text-center mb-3">Continue with</p>
          <div className="flex gap-3">
            {onAppleLogin && (
              <motion.button
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                onClick={onAppleLogin}
                disabled={isLoading}
                className="flex-1 border border-white bg-black hover:bg-stone-900 text-white px-4 py-4 font-mono text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="white">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Apple
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="flex-1 border border-white bg-black hover:bg-stone-900 text-white px-4 py-4 font-mono text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
                <path d="M5.84 14.09A6.97 6.97 0 0 1 5.49 12c0-.72.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" fill="white"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
              </svg>
              Google
            </motion.button>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-stone-700"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-black px-4 font-mono text-xs uppercase tracking-widest text-white">
                Or
              </span>
            </div>
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block font-mono text-xs uppercase tracking-wider text-white mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full border border-white bg-black px-4 py-3 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed placeholder-stone-500"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block font-mono text-xs uppercase tracking-wider text-white mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full border border-white bg-black px-4 py-3 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed placeholder-stone-500"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-red-950/20 border border-red-500"
              >
                <p className="font-mono text-xs text-red-500 uppercase tracking-wider">
                  {error}
                </p>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full border border-white bg-white hover:bg-stone-100 text-black px-6 py-4 font-mono text-sm uppercase tracking-widest transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Login'
              )}
            </motion.button>
          </form>

          {/* Forgot password */}
          <div className="text-center mt-4">
            <a href="#" className="font-mono text-xs text-white hover:text-stone-300 transition-colors">
              /recover-password
            </a>
          </div>
        </div>

        {/* Create account */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6"
        >
          <p className="font-mono text-sm text-white">
            Don't have an account?{' '}
            <button
              onClick={onCreateAccount}
              className="text-white font-bold hover:text-stone-300 transition-colors"
            >
              /create-account
            </button>
          </p>
        </motion.div>
      </motion.div>

      {/* Scrolling pixel assets at bottom - commented out as requested */}
      {/* 
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent overflow-hidden pointer-events-none">
        <motion.div
          className="flex gap-96 pt-4"
          animate={{ x: ['0%', '-100%'] }}
          transition={{
            duration: 200,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ width: '200%' }}
        >
          {PIXEL_ASSETS.map((asset, idx) => (
            <motion.img
              key={`set1-${idx}`}
              src={asset}
              alt=""
              className="h-20 w-auto flex-shrink-0 object-contain"
            />
          ))}
          {PIXEL_ASSETS.map((asset, idx) => (
            <motion.img
              key={`set2-${idx}`}
              src={asset}
              alt=""
              className="h-20 w-auto flex-shrink-0 object-contain"
            />
          ))}
        </motion.div>
      </div>
      */}
    </div>
  );
}