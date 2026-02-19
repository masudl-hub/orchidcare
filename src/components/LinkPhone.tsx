import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

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

interface LinkPhoneProps {
  onComplete: () => void;
  onBack: () => void;
}

export function LinkPhone({ onComplete, onBack }: LinkPhoneProps) {
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [replacedIndex, setReplacedIndex] = useState<number | null>(null);
  const [currentAsset, setCurrentAsset] = useState<string>('');

  useEffect(() => {
    const chars = ['/', 'L', 'I', 'N', 'K', ' ', 'P', 'H', 'O', 'N', 'E'];
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

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    // Send verification code via iMessage
    console.log('Sending code to:', phoneNumber);
    setStep('verify');
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    // Verify the code
    console.log('Verifying code:', code);
    onComplete();
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
        {/* Header */}
        <div className="text-center mb-12">
          <h1 style={{ fontFamily: '"Press Start 2P", cursive' }} className="text-4xl text-white mb-2 flex justify-center items-center h-16">
            {['/', 'L', 'I', 'N', 'K', ' ', 'P', 'H', 'O', 'N', 'E'].map((char, i) => (
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
          <p className="font-mono text-sm text-white">
            {step === 'phone' 
              ? 'Connect your iMessage to access Orchid anywhere.'
              : 'Enter the code we sent to your iMessage.'}
          </p>
        </div>

        {/* Link phone container */}
        <div className="bg-black border border-white p-8">
          {step === 'phone' ? (
            <form onSubmit={handleSendCode} className="space-y-6">
              <div>
                <label htmlFor="phone" className="block font-mono text-xs uppercase tracking-wider text-white mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full border border-white bg-black px-4 py-3 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black placeholder-stone-500"
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </div>

              <div className="bg-stone-900/50 border border-stone-800 p-4">
                <p className="font-mono text-xs text-stone-400">
                  We'll send a verification code to your iMessage. Standard messaging rates may apply.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full border border-white bg-white hover:bg-stone-100 text-black px-6 py-4 font-mono text-sm uppercase tracking-widest transition-colors"
              >
                Send Code
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-white mb-4 text-center">
                  Verification Code
                </label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                  >
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot 
                          key={index}
                          index={index} 
                          className="border border-white bg-black w-12 h-14 text-xl font-mono text-white" 
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="font-mono text-xs text-stone-500 hover:text-white transition-colors uppercase tracking-wider"
                >
                  Didn't receive a code? Resend
                </button>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={code.length !== 6}
                className="w-full border border-white bg-white hover:bg-stone-100 text-black px-6 py-4 font-mono text-sm uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify & Continue
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
