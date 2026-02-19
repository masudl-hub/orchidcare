// Pixel Canvas — shared types
// Grid dimensions: 70 cols × 98 rows (5:7 aspect ratio)

export const GRID_COLS = 70;
export const GRID_ROWS = 98;
export const MAX_PIXELS = GRID_COLS * GRID_ROWS; // 6,860

// Default orchid source image
export const ORCHID_SRC =
  '/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_pixel_bw_light.png';

// ---------------------------------------------------------------------------
// Formation types — what the LLM sends via show_visual tool call
// ---------------------------------------------------------------------------

export type TransitionType = 'morph' | 'dissolve' | 'scatter' | 'ripple';

export interface Formation {
  type: 'template' | 'text' | 'list' | 'svg' | 'pixels' | 'compound';
  id?: string;            // template name (e.g. "monstera_deliciosa")
  text?: string;          // for type='text'
  items?: string[];       // for type='list'
  svgPath?: string;       // for type='svg'
  pixels?: boolean[][];   // for type='pixels' (direct grid)
  transition?: TransitionType;
  duration?: number;      // ms, default 1200
  hold?: number;          // seconds before returning to orchid, 0 = indefinite
}

// ---------------------------------------------------------------------------
// Precomputed formation data — stored in formations.json
// ---------------------------------------------------------------------------

export interface FormationData {
  id: string;             // e.g. "monstera_deliciosa"
  category: 'plant' | 'tool' | 'icon';
  cols: number;           // always GRID_COLS (70)
  rows: number;           // always GRID_ROWS (98)
  bits: string;           // base64-encoded Uint8Array bitfield
  pixelCount: number;     // number of active pixels
  displayName: string;    // human-readable: "Monstera Deliciosa"
}

// ---------------------------------------------------------------------------
// Decoded formation entry — ready for FormationEngine
// ---------------------------------------------------------------------------

export interface FormationEntry {
  id: string;
  category: 'plant' | 'tool' | 'icon';
  displayName: string;
  pixelCount: number;
  positions: { x: number; y: number }[];
}

// ---------------------------------------------------------------------------
// FormationEngine state
// ---------------------------------------------------------------------------

export type EngineState = 'idle' | 'morphing_to' | 'holding' | 'morphing_back';
