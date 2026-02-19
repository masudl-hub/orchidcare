import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf } from 'lucide-react';
import { motion } from 'framer-motion';

// TODO: Extract CollectionView from Dashboard component and wire to usePlants hook

export default function Plants() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f8f8] p-4 relative overflow-hidden">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        onClick={() => navigate('/dashboard')}
        className="absolute top-8 left-8 font-mono text-sm uppercase tracking-widest text-black hover:text-stone-600 transition-colors flex items-center gap-2"
      >
        <ArrowLeft size={16} />
        Back
      </motion.button>

      <div className="max-w-4xl mx-auto pt-24">
        {/* Header */}
        <div className="mb-8 border-b border-black pb-6">
          <div className="flex items-center gap-3 mb-2">
            <Leaf size={24} className="text-black" />
            <h1 className="text-4xl md:text-5xl font-serif text-black">Collection</h1>
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-500">
            YOUR PLANT COLLECTION
          </p>
        </div>

        {/* Placeholder for plant collection */}
        <div className="bg-white border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
          <p className="font-mono text-sm text-stone-500 text-center">
            Plant collection will be displayed here.
            <br />
            <span className="text-xs">TODO: Extract CollectionView from Dashboard and wire to usePlants hook</span>
          </p>
        </div>
      </div>
    </div>
  );
}
