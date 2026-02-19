const BW_ORCHID_SRC =
  "/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_pixel_bw_light.png";

// The orchid pixel art is ~20×30 blocks (804×1190 source).
// We sample at natural aspect ratio, NOT forced square.
const NATIVE_COLS = 20;
const NATIVE_ROWS = 30;

export interface OrchidGrid {
  grid: boolean[][]; // true = light/content pixel (the orchid), false = dark/background
  cols: number;
  rows: number;
}

export function sampleOrchidGrid(): Promise<OrchidGrid> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = NATIVE_COLS;
      canvas.height = NATIVE_ROWS;
      const ctx = canvas.getContext("2d")!;

      // Draw full image at native pixel-art resolution (no cropping)
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, NATIVE_COLS, NATIVE_ROWS);

      const imageData = ctx.getImageData(0, 0, NATIVE_COLS, NATIVE_ROWS);
      const grid: boolean[][] = [];

      for (let r = 0; r < NATIVE_ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < NATIVE_COLS; c++) {
          const idx = (r * NATIVE_COLS + c) * 4;
          const brightness = imageData.data[idx]; // R channel (grayscale)
          grid[r][c] = brightness > 128; // true = light (content), false = dark (background)
        }
      }

      resolve({ grid, cols: NATIVE_COLS, rows: NATIVE_ROWS });
    };
    img.onerror = reject;
    img.src = BW_ORCHID_SRC;
  });
}
