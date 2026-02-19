// Demo usage tracking with localStorage + lightweight fingerprinting

const DEMO_COUNT_KEY = 'viridis-demo-count';
const DEMO_FINGERPRINT_KEY = 'viridis-demo-fp';
const MAX_DEMO_EXCHANGES = 3;

// Lightweight canvas fingerprint (no external library)
async function generateFingerprint(): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'fallback-' + Math.random().toString(36).slice(2);
  
  canvas.width = 200;
  canvas.height = 50;
  
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('Orchid 🌱', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('Orchid 🌱', 4, 17);
  
  const dataUrl = canvas.toDataURL();
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < dataUrl.length; i++) {
    const char = dataUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return hash.toString(36);
}

async function getOrCreateFingerprint(): Promise<string> {
  let fp = localStorage.getItem(DEMO_FINGERPRINT_KEY);
  if (!fp) {
    fp = await generateFingerprint();
    localStorage.setItem(DEMO_FINGERPRINT_KEY, fp);
  }
  return fp;
}

export function getDemoExchangeCount(): number {
  const count = localStorage.getItem(DEMO_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
}

export function incrementDemoCount(): number {
  const newCount = getDemoExchangeCount() + 1;
  localStorage.setItem(DEMO_COUNT_KEY, newCount.toString());
  return newCount;
}

export function canSendDemoMessage(): boolean {
  // Developer bypass
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('viridis_dev') === 'true') return true;
    if (localStorage.getItem('viridis_unlimited') === 'true') return true;
  }
  
  return getDemoExchangeCount() < MAX_DEMO_EXCHANGES;
}

export function isLastDemoExchange(): boolean {
  return getDemoExchangeCount() === MAX_DEMO_EXCHANGES - 1;
}

export function hasReachedLimit(): boolean {
  return getDemoExchangeCount() >= MAX_DEMO_EXCHANGES;
}

export function resetDemoCount(): void {
  localStorage.removeItem(DEMO_COUNT_KEY);
}

// Initialize fingerprint on load
export async function initDemoTracking(): Promise<void> {
  await getOrCreateFingerprint();
}
