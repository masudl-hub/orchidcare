import qrcode from "qrcode-generator";

export interface QRMatrix {
  moduleCount: number;
  grid: boolean[][]; // true = dark module
}

export function generateQRMatrix(
  data: string,
  ecLevel: "L" | "M" | "Q" | "H" = "L"
): QRMatrix {
  const qr = qrcode(2, ecLevel); // Version 2 = 25×25 modules
  qr.addData(data);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const grid: boolean[][] = [];

  for (let r = 0; r < moduleCount; r++) {
    grid[r] = [];
    for (let c = 0; c < moduleCount; c++) {
      grid[r][c] = qr.isDark(r, c);
    }
  }

  return { moduleCount, grid };
}
