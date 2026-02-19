// SVG Patterns and Technical Botanical Illustrations for Botanical Brutalist Design

export const EtchingPatterns = () => (
  <svg className="absolute w-0 h-0">
    <defs>
      <pattern id="halftone" width="4" height="4" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor" className="text-stone-300" />
      </pattern>
      <pattern id="diagonal-thin" width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" stroke="currentColor" strokeWidth="0.5" className="text-stone-400" />
      </pattern>
      <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-stone-200" />
      </pattern>
      <pattern id="dots-pattern" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="5" cy="5" r="0.5" fill="currentColor" className="text-stone-300" />
      </pattern>
    </defs>
  </svg>
);

// Etched botanical leaf illustration (technical/scientific style)
export const EtchedLeaf = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="1">
    <path d="M50,90 Q50,50 20,20 M50,90 Q50,50 80,20 M50,90 L50,10" strokeLinecap="round" />
    <path d="M50,30 L30,40 M50,45 L25,55 M50,60 L30,70" strokeLinecap="round" />
    <path d="M50,30 L70,40 M50,45 L75,55 M50,60 L70,70" strokeLinecap="round" />
  </svg>
);

// Monstera leaf (etched style)
export const EtchedMonstera = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="1">
    <ellipse cx="50" cy="50" rx="35" ry="40" />
    <path d="M50,10 L50,90" />
    <path d="M50,20 L25,25 M50,35 L20,40 M50,50 L22,55 M50,65 L25,70 M50,80 L30,82" />
    <path d="M50,20 L75,25 M50,35 L80,40 M50,50 L78,55 M50,65 L75,70 M50,80 L70,82" />
    <ellipse cx="35" cy="35" rx="4" ry="6" />
    <ellipse cx="65" cy="35" rx="4" ry="6" />
    <ellipse cx="30" cy="55" rx="3" ry="5" />
    <ellipse cx="70" cy="55" rx="3" ry="5" />
  </svg>
);

// Fern frond (etched style)
export const EtchedFern = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="0.8">
    <path d="M50,95 Q48,70 45,50 Q43,30 50,5" />
    {[...Array(12)].map((_, i) => {
      const y = 15 + i * 6.5;
      const width = 12 - Math.abs(i - 6) * 1.5;
      return (
        <g key={i}>
          <path d={`M50,${y} Q${45 - width},${y - 2} ${35 - width},${y - 1}`} />
          <path d={`M50,${y} Q${55 + width},${y - 2} ${65 + width},${y - 1}`} />
        </g>
      );
    })}
  </svg>
);

// Palm frond (etched style)
export const EtchedPalm = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="1">
    <path d="M50,90 L50,20" />
    <path d="M50,20 Q30,10 10,5" />
    <path d="M50,20 Q70,10 90,5" />
    <path d="M50,25 Q25,18 5,15" />
    <path d="M50,25 Q75,18 95,15" />
    <path d="M50,30 Q20,28 2,30" />
    <path d="M50,30 Q80,28 98,30" />
  </svg>
);
