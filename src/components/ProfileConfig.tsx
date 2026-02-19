import { motion, AnimatePresence } from 'framer-motion';
import { BrutalistTooltip } from '@/components/BrutalistTooltip';
import { useState, useEffect } from 'react';
import { Dog, Cat, Bird, Fish, Rabbit, Sun, Zap, Lightbulb, Microscope, Loader2, Sprout, Flower2, TreeDeciduous, BellOff, Bell, CalendarDays, CalendarRange, Calendar } from 'lucide-react';

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

// Profile data that will be saved to the backend
export interface ProfileData {
  personality: 'warm' | 'playful' | 'expert' | 'philosophical';
  experience_level: 'beginner' | 'intermediate' | 'expert';
  notification_frequency: 'none' | 'daily' | 'weekly' | 'bi-weekly' | 'monthly';
  location?: string;
  display_name?: string;
  primary_concerns?: string[];
  pets?: string[];
}

interface ProfileConfigProps {
  onComplete: (data: ProfileData) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const experienceLevels = [
  { id: 'beginner', label: 'Beginner', description: 'Just starting out', icon: Sprout },
  { id: 'intermediate', label: 'Intermediate', description: 'Some experience', icon: Flower2 },
  { id: 'expert', label: 'Expert', description: 'Green thumb pro', icon: TreeDeciduous },
];

const notificationFrequencies = [
  { id: 'none', label: 'None', description: 'No proactive messages', icon: BellOff },
  { id: 'daily', label: 'Daily', description: 'Once a day', icon: Bell },
  { id: 'weekly', label: 'Weekly', description: 'Once a week', icon: CalendarDays },
  { id: 'bi-weekly', label: 'Bi-Weekly', description: 'Every two weeks', icon: CalendarRange },
  { id: 'monthly', label: 'Monthly', description: 'Once a month', icon: Calendar },
];

const personalities = [
  { id: 'warm', label: 'Warm', description: 'Friendly and encouraging', icon: Sun },
  { id: 'playful', label: 'Playful', description: 'Fun and lighthearted', icon: Zap },
  { id: 'expert', label: 'Expert', description: 'Precise and technical', icon: Microscope },
  { id: 'philosophical', label: 'Philosophical', description: 'Thoughtful and poetic', icon: Lightbulb },
];

const interests = [
  'Houseplants',
  'Gardening',
  'Native Plants',
  'Succulents',
  'Herbs & Vegetables',
  'Rare Species',
  'Plant Care',
  'Landscaping',
];

const petOptions = [
  { id: 'dog', label: 'Dog', icon: Dog },
  { id: 'cat', label: 'Cat', icon: Cat },
  { id: 'bird', label: 'Bird', icon: Bird },
  { id: 'fish', label: 'Fish', icon: Fish },
  { id: 'rabbit', label: 'Rabbit', icon: Rabbit },
];

export function ProfileConfig({ onComplete, onBack, isLoading = false, error = null }: ProfileConfigProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ProfileData['experience_level'] | ''>('');
  const [notificationFrequency, setNotificationFrequency] = useState<ProfileData['notification_frequency'] | ''>('');
  const [personality, setPersonality] = useState<ProfileData['personality'] | ''>('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [replacedIndex, setReplacedIndex] = useState<number | null>(null);
  const [currentAsset, setCurrentAsset] = useState<string>('');

  useEffect(() => {
    const chars = ['/', 'P', 'R', 'O', 'F', 'I', 'L', 'E'];
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

  const displayError = localError || error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    if (!experienceLevel) {
      setLocalError('Please select your experience level');
      return;
    }
    
    if (!notificationFrequency) {
      setLocalError('Please select a notification frequency');
      return;
    }
    
    if (!personality) {
      setLocalError('Please select a personality for your agent');
      return;
    }
    
    // Build profile data for backend
    const profileData: ProfileData = {
      personality: personality as ProfileData['personality'],
      experience_level: experienceLevel as ProfileData['experience_level'],
      notification_frequency: notificationFrequency as ProfileData['notification_frequency'],
      ...(location && { location }),
      ...(name && { display_name: name }),
      ...(selectedInterests.length > 0 && { primary_concerns: selectedInterests }),
      ...(selectedPets.length > 0 && { pets: selectedPets }),
    };
    
    await onComplete(profileData);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const togglePet = (petId: string) => {
    setSelectedPets(prev =>
      prev.includes(petId)
        ? prev.filter(p => p !== petId)
        : [...prev, petId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black flex justify-center overflow-y-auto pt-24 pb-12">
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
        className="w-full max-w-4xl relative z-10 px-8 md:px-16"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <h1 style={{ fontFamily: '"Press Start 2P", cursive' }} className="text-4xl text-white mb-4 flex justify-center items-center h-16">
            {['/', 'P', 'R', 'O', 'F', 'I', 'L', 'E'].map((char, i) => (
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
            Help us tailor Orchid to your botanical needs.
          </p>
        </div>

        {/* Profile config container */}
        <div className="bg-black border border-white p-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Name and Location - Two Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block font-mono text-xs uppercase tracking-wider text-white mb-3">
                  What should we call you? <span className="text-stone-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="w-full border border-white bg-black px-4 py-3 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed placeholder-stone-600"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="location" className="block font-mono text-xs uppercase tracking-wider text-white mb-3">
                  Location <span className="text-stone-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isLoading}
                  className="w-full border border-white bg-black px-4 py-3 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed placeholder-stone-600"
                  placeholder="City or ZIP code"
                />
              </div>
            </div>

            {/* Experience Level and Pets - Two Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Experience Level */}
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-white mb-4">
                  Experience Level <span className="text-white">*</span>
                </label>
                <div className="flex gap-6 flex-wrap">
                  {experienceLevels.map((level) => {
                    const Icon = level.icon;
                    const isSelected = experienceLevel === level.id;
                    return (
                      <BrutalistTooltip key={level.id} content={`${level.label}: ${level.description}`}>
                        <button
                          type="button"
                          onClick={() => setExperienceLevel(level.id as ProfileData['experience_level'])}
                          disabled={isLoading}
                          className="transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50"
                        >
                          <Icon 
                            size={32} 
                            fill={isSelected ? "white" : "none"} 
                            strokeWidth={1.5} 
                            className={isSelected ? 'text-white' : 'text-white/70'} 
                          />
                        </button>
                      </BrutalistTooltip>
                    );
                  })}
                </div>
                <AnimatePresence mode="wait">
                  {experienceLevel && (
                    <motion.p 
                      key={experienceLevel}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className="mt-4 font-mono text-[10px] text-stone-400 uppercase tracking-wider"
                    >
                      {experienceLevels.find(l => l.id === experienceLevel)?.label}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Pets */}
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-white mb-4">
                  Do you have pets?
                </label>
                <div className="flex gap-6 flex-wrap">
                  {petOptions.map((pet) => {
                    const Icon = pet.icon;
                    const isSelected = selectedPets.includes(pet.id);
                    return (
                      <BrutalistTooltip key={pet.id} content={pet.label}>
                        <button
                          type="button"
                          onClick={() => togglePet(pet.id)}
                          disabled={isLoading}
                          className="transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50"
                        >
                          <Icon 
                            size={32} 
                            fill={isSelected ? "white" : "none"} 
                            strokeWidth={1.5} 
                            className={isSelected ? 'text-white' : 'text-white/70'} 
                          />
                        </button>
                      </BrutalistTooltip>
                    );
                  })}
                </div>
                <AnimatePresence mode="wait">
                  {selectedPets.length > 0 && (
                    <motion.p 
                      key={selectedPets.join(',')}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className="mt-4 font-mono text-[10px] text-stone-400 uppercase tracking-wider"
                    >
                      Active: {selectedPets.map(id => petOptions.find(p => p.id === id)?.label).join(', ')}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-white mb-4">
                Interests
              </label>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <motion.button
                    key={interest}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleInterest(interest)}
                    disabled={isLoading}
                    className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 ${
                      selectedInterests.includes(interest)
                        ? 'border-white bg-white text-black'
                        : 'border-stone-700 bg-black text-white hover:border-white'
                    }`}
                  >
                    {interest}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Proactive Notifications and Agent Personality - Two Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Notification Frequency */}
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-white mb-4">
                  Notification Frequency <span className="text-white">*</span>
                </label>
                <div className="flex gap-6 flex-wrap">
                  {notificationFrequencies.map((freq) => {
                    const Icon = freq.icon;
                    const isSelected = notificationFrequency === freq.id;
                    return (
                      <BrutalistTooltip key={freq.id} content={`${freq.label}: ${freq.description}`}>
                        <button
                          type="button"
                          onClick={() => setNotificationFrequency(freq.id as ProfileData['notification_frequency'])}
                          disabled={isLoading}
                          className="transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50"
                        >
                          <Icon 
                            size={32} 
                            fill={isSelected ? "white" : "none"} 
                            strokeWidth={1.5} 
                            className={isSelected ? 'text-white' : 'text-white/70'} 
                          />
                        </button>
                      </BrutalistTooltip>
                    );
                  })}
                </div>
              </div>

              {/* Personality Selection */}
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-white mb-4">
                  Agent Personality <span className="text-white">*</span>
                </label>
                <div className="flex gap-6 flex-wrap">
                  {personalities.map((p) => {
                    const Icon = p.icon;
                    const isSelected = personality === p.id;
                    return (
                      <BrutalistTooltip key={p.id} content={`${p.label}: ${p.description}`}>
                        <button
                          type="button"
                          onClick={() => setPersonality(p.id as ProfileData['personality'])}
                          disabled={isLoading}
                          className="transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50"
                        >
                          <Icon 
                            size={32} 
                            fill={isSelected ? "white" : "none"} 
                            strokeWidth={1.5} 
                            className={isSelected ? 'text-white' : 'text-white/70'} 
                          />
                        </button>
                      </BrutalistTooltip>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Error message */}
            {displayError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-950/20 border border-red-500"
              >
                <p className="font-mono text-xs text-red-500 uppercase tracking-wider">
                  {displayError}
                </p>
              </motion.div>
            )}

            {/* Submit Button */}
            {(() => {
              const missingFields: string[] = [];
              if (!experienceLevel) missingFields.push('Experience');
              if (!notificationFrequency) missingFields.push('Frequency');
              if (!personality) missingFields.push('Personality');
              
              const isFormComplete = missingFields.length === 0;

              return (
                <div className="w-full pt-4">
                  <motion.button
                    whileHover={{ scale: (isLoading || !isFormComplete) ? 1 : 1.02 }}
                    whileTap={{ scale: (isLoading || !isFormComplete) ? 1 : 0.98 }}
                    type="submit"
                    disabled={isLoading || !isFormComplete}
                    className="w-full border border-white bg-white hover:bg-stone-100 text-black px-6 py-4 font-mono text-sm uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Complete Setup'
                  )}
                  </motion.button>
                  {!isFormComplete && !isLoading && (
                    <p className="mt-4 text-center font-mono text-[10px] text-stone-600 uppercase tracking-widest leading-relaxed">
                      Missing: {missingFields.join(' / ')}
                    </p>
                  )}
                </div>
              );
            })()}
          </form>
        </div>
      </motion.div>
    </div>
  );
}