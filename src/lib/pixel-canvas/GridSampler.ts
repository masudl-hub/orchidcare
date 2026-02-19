// GridSampler — generalized image-to-grid converter (browser-side)
// Converts any image to a boolean[][] grid at the specified dimensions.
// Used at runtime for the orchid home formation and any dynamic images.

import { GRID_COLS, GRID_ROWS } from './types';

export interface SampleResult {
  grid: boolean[][];
  cols: number;
  rows: number;
  pixelCount: number;
}

/**
 * Load an image and sample it into a boolean grid.
 * Dark pixels (brightness < 128) on a light background become active (true).
 * The image is aspect-ratio-preserved and centered within the grid.
 */
export function sampleImage(
  imagePath: string,
  gridCols: number = GRID_COLS,
  gridRows: number = GRID_ROWS,
): Promise<SampleResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const result = sampleFromImageElement(img, gridCols, gridRows);
      resolve(result);
    };
    img.onerror = reject;
    img.src = imagePath;
  });
}

/**
 * Sample an already-loaded HTMLImageElement into a boolean grid.
 */
export function sampleFromImageElement(
  img: HTMLImageElement,
  gridCols: number = GRID_COLS,
  gridRows: number = GRID_ROWS,
): SampleResult {
  const aspect = img.width / img.height;

  // Determine sampling dimensions that preserve aspect ratio
  let sampleCols: number;
  let sampleRows: number;

  if (aspect < gridCols / gridRows) {
    // Image is taller relative to grid — fit height
    sampleRows = gridRows;
    sampleCols = Math.round(gridRows * aspect);
  } else {
    // Image is wider relative to grid — fit width
    sampleCols = gridCols;
    sampleRows = Math.round(gridCols / aspect);
  }

  // Clamp to grid bounds
  sampleCols = Math.min(sampleCols, gridCols);
  sampleRows = Math.min(sampleRows, gridRows);

  // Draw image at sampling resolution
  const canvas = document.createElement('canvas');
  canvas.width = sampleCols;
  canvas.height = sampleRows;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, sampleCols, sampleRows);

  const imageData = ctx.getImageData(0, 0, sampleCols, sampleRows);

  // Build full grid with centering offset
  const grid: boolean[][] = Array.from({ length: gridRows }, () =>
    Array(gridCols).fill(false),
  );

  const offX = Math.floor((gridCols - sampleCols) / 2);
  const offY = Math.floor((gridRows - sampleRows) / 2);

  let pixelCount = 0;
  for (let r = 0; r < sampleRows; r++) {
    for (let c = 0; c < sampleCols; c++) {
      const i = (r * sampleCols + c) * 4;
      const brightness =
        (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
      if (brightness < 128) {
        grid[offY + r][offX + c] = true;
        pixelCount++;
      }
    }
  }

  return { grid, cols: gridCols, rows: gridRows, pixelCount };
}

/**
 * Convert a boolean[][] grid to an array of {x, y} positions (grid coordinates).
 */
export function gridToPositions(
  grid: boolean[][],
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c]) {
        positions.push({ x: c, y: r });
      }
    }
  }
  return positions;
}
