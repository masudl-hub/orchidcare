import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Zap,
  Brain,
  CheckCircle2,
  Grid3X3,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// ASCII Display Component - Visual Metaphor for Detection Stages
// ============================================================================

const AsciiDisplay = ({
  visibility,
}: {
  visibility: "full" | "partial" | "minimal" | "sketch";
}) => {
  // Orchid ASCII representation - visual metaphor for scanning process
  const fullAscii = `
                    ,@@@@@@@,
                @@@@@@'O'@@@@@@
              @@@@'  o o  '@@@@
            @@@@'     >     '@@@
           @@@'    __\\_/__     '@@
          @@@'   /|     |\\     '@
         @@'    < |     | >    '@
         @@'      |===|        '@
         @@'      |   |        '@
          @@@'   /|   |\\      '@@
           @@@'   |   |       '@@
            @@@@'      '    '@@@@
              @@@@@@'"""'@@@@@@
                @@@@@@@@@@@@
  `;

  const partialAscii = `
                    ,###
                  #######
                ##      ##
              ##          ##
             ##   ___     ##
            ##   /   \\    #
           ##   < ||| >   #
            ##   |||||    #
             ##  |||||   ##
              ##          #
                ##      ##
                  #######
  `;

  const minimalAscii = `
              ▓▓▓
            ▓▓   ▓▓
          ▓▓       ▓▓
         ▓▓   ██   ▓▓
        ▓▓   ▓▓▓▓  ▓▓
         ▓▓        ▓▓
          ▓▓     ▓▓
            ▓▓▓▓
  `;

  const sketchAscii = `
              █▓░
            █▓░   ░▓█
          █▓░       ░▓█
         █▓░         ░▓█
        █▓░   ░░░░   ░▓█
         █▓░  ░░░░░  ░▓█
          █▓░░░░░░░░░▓█
            █▓░░░░░░▓█
              █▓░░░▓█
  `;

  const getAsciiContent = () => {
    switch (visibility) {
      case "full":
        return fullAscii;
      case "partial":
        return partialAscii;
      case "minimal":
        return minimalAscii;
      case "sketch":
        return sketchAscii;
      default:
        return fullAscii;
    }
  };

  return (
    <pre className="text-[0.6rem] leading-[0.8rem] font-mono whitespace-pre text-black font-bold select-none">
      {getAsciiContent()}
    </pre>
  );
};

// ============================================================================
// SCAN LAYERS - Progressive Detection Analysis
// ============================================================================

const ScanLayers = () => {
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(true);

  // Auto-start scan on mount
  useEffect(() => {
    const stages = [
      { stage: 0 as const, log: "Initializing camera..." },
      { stage: 1 as const, log: "Extracting visual features..." },
      { stage: 2 as const, log: "Analyzing morphological patterns..." },
      { stage: 3 as const, log: "Match confirmed: Phalaenopsis hybrid" },
    ];

    // Animate scan line from 0 to 100%
    const scanDuration = 3000; // 3 seconds for scan line
    const startTime = Date.now();

    const animateScan = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / scanDuration) * 100, 100);
      setScanProgress(progress);

      if (progress < 100) {
        requestAnimationFrame(animateScan);
      } else {
        // Scan complete, show analysis
        setIsScanning(false);
        stages.forEach((stage, idx) => {
          setTimeout(() => {
            setStage(stage.stage);
            setLogs((prev) => [...prev, stage.log]);
          }, idx * 300);
        });
      }
    };

    // Start scan animation after brief delay
    setTimeout(() => {
      requestAnimationFrame(animateScan);
    }, 500);
  }, []);

  const getVisibility = (): "full" | "partial" | "minimal" | "sketch" => {
    switch (stage) {
      case 0:
        return "full";
      case 1:
        return "partial";
      case 2:
        return "minimal";
      case 3:
        return "sketch";
      default:
        return "full";
    }
  };

  const analysisSteps = [
    {
      title: "SPECIES RECOGNITION",
      findings: [
        "Flower morphology: Phalaenopsis characteristics identified",
        "Inflorescence pattern: Raceme structure confirmed",
        "Color distribution: Magenta-pink petals with white center",
        "Leaf shape: Oblong-lanceolate, characteristic of genus"
      ]
    },
    {
      title: "HEALTH ASSESSMENT",
      findings: [
        "Leaf texture: Smooth, turgid, no necrotic spots",
        "Stem integrity: No visible damage or disease",
        "Root visibility: Not clearly visible in frame",
        "Overall vigor: Appears healthy and actively flowering"
      ]
    },
    {
      title: "ENVIRONMENTAL ANALYSIS",
      findings: [
        "Light exposure: Bright indirect light recommended",
        "Humidity level: 50-80% optimal for this cultivar",
        "Temperature range: 18-24°C preferred",
        "Watering frequency: Weekly during growing season"
      ]
    }
  ];

  return (
    <div className="space-y-8 py-8">
      <div className="border-b-2 border-black pb-6">
        <h1 className="text-4xl font-serif font-bold mb-3">SCAN LAYERS</h1>
        <p className="text-stone-700 max-w-2xl">
          Visual progression through the detection pipeline. Each layer isolates
          morphological data until species identification is confirmed.
        </p>
      </div>

      {/* Main visualization */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left: Stage visualization */}
        <div className="col-span-7 space-y-6">
          {/* Image transformation area */}
          <div className="border-2 border-black bg-white rounded-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="h-[450px] flex items-center justify-center bg-stone-50 rounded-t-sm relative overflow-hidden">
              <div className="relative w-64 h-64">
                {/* Pixelated layer - underneath, visible below scan line */}
                <img
                  src="/plant_assets_art/orchid_in_pot/orchid_in_pot_pixel_color.png"
                  alt="Orchid pixelated"
                  className="absolute inset-0 w-full h-full object-contain"
                />

                {/* Transparent layer - on top, clipped to reveal pixelated below */}
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: isScanning
                      ? `inset(0 0 ${100 - scanProgress}% 0)`
                      : "none",
                  }}
                >
                  <img
                    src="/plant_assets_art/orchid_in_pot/orchid_in_pot_transparent.png"
                    alt="Orchid"
                    className="w-full h-full object-contain drop-shadow-lg"
                  />
                </div>

                {/* Scanning line */}
                {isScanning && (
                  <div
                    className="absolute left-0 right-0 h-1 bg-black z-10"
                    style={{
                      top: `${scanProgress}%`,
                      boxShadow:
                        "0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.4)",
                    }}
                  />
                )}
              </div>

              {/* Progress indicator overlay */}
              {isScanning && (
                <div className="absolute top-4 right-4 bg-black text-white px-3 py-2 rounded font-mono text-xs font-bold border border-stone-600">
                  SCANNING {Math.round(scanProgress)}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Analysis log */}
        <div className="col-span-5">
          <div className="border-2 border-black bg-white rounded-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col">
            <div className="bg-black text-white px-4 py-3 rounded-t-sm border-b-2 border-black">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                <Grid3X3 size={14} />
                Detection Analysis
              </h3>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {!isScanning && logs.length === 0 && (
                <div className="text-stone-400 italic text-sm text-center py-8">
                  Start scan to analyze...
                </div>
              )}

              {logs.length > 0 && (
                <>
                  {/* Species Recognition Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="border border-black rounded-lg overflow-hidden bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <div className="bg-black text-white px-3 py-2 flex items-center gap-2">
                      <CheckCircle2 size={12} />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                        Species
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-stone-600">Common:</span>
                        <span className="text-xs font-bold">Moth Orchid</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-stone-600">Scientific:</span>
                        <span className="text-xs font-serif italic">Phalaenopsis</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-stone-600">Family:</span>
                        <span className="text-xs">Orchidaceae</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Health Metrics Grid */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="grid grid-cols-2 gap-2"
                  >
                    <div className="border border-stone-300 rounded-lg p-3 bg-stone-50">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
                        Leaf Health
                      </div>
                      <div className="text-lg font-bold">9.2/10</div>
                      <div className="w-full bg-stone-200 h-1.5 rounded-full mt-2">
                        <div className="bg-black h-1.5 rounded-full" style={{ width: "92%" }} />
                      </div>
                    </div>

                    <div className="border border-stone-300 rounded-lg p-3 bg-stone-50">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
                        Stem Vigor
                      </div>
                      <div className="text-lg font-bold">8.7/10</div>
                      <div className="w-full bg-stone-200 h-1.5 rounded-full mt-2">
                        <div className="bg-black h-1.5 rounded-full" style={{ width: "87%" }} />
                      </div>
                    </div>
                  </motion.div>

                  {/* Environmental Conditions */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="border border-black rounded-lg overflow-hidden bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <div className="bg-stone-100 border-b border-stone-300 px-3 py-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                        Environment
                      </span>
                    </div>
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-stone-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                          Light
                        </span>
                        <span className="font-mono font-bold">Indirect</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-stone-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                          Humidity
                        </span>
                        <span className="font-mono font-bold">50-80%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-stone-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                          Temp Range
                        </span>
                        <span className="font-mono font-bold">18-24°C</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-stone-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                          Water
                        </span>
                        <span className="font-mono font-bold">Weekly</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Confidence Badge */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65 }}
                    className="border-2 border-black rounded-lg p-3 bg-white text-center"
                  >
                    <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
                      Match Confidence
                    </div>
                    <div className="text-3xl font-bold mb-2">94.3%</div>
                    <div className="inline-block px-3 py-1 bg-black text-white rounded-full text-[10px] font-mono font-bold uppercase">
                      High Accuracy
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control button */}
      <div className="flex justify-center">
        <div className="text-xs font-mono text-stone-500 italic">
          {isScanning ? "Scanning in progress..." : "Scan complete"}
        </div>
      </div>

      {/* Info section */}
      <div className="border-2 border-black bg-stone-50 rounded-lg p-6 space-y-4">
        <h3 className="font-mono font-bold uppercase tracking-wider text-sm">
          Detection Pipeline
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold">Layer 1 – Capture:</span> Raw botanical
            specimen input
          </div>
          <div>
            <span className="font-bold">Layer 2 – Extract:</span> Color and
            shape feature isolation
          </div>
          <div>
            <span className="font-bold">Layer 3 – Analyze:</span> Morphological
            pattern recognition
          </div>
          <div>
            <span className="font-bold">Layer 4 – Identify:</span> Database
            cross-reference and match
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN EXPLORATIONS PAGE
// ============================================================================
const Explorations = () => {
  return (
    <div className="min-h-screen bg-white pt-20 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <ScanLayers />
      </div>
    </div>
  );
};

export default Explorations;
