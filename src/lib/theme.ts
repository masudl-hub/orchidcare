// Theme system for easy switching between color palettes
// Both themes use the same components - just swap CSS variables

export type ThemeMode = 'emerald-night' | 'botanical-cream';

export const themes = {
  'emerald-night': {
    name: 'Emerald Night',
    description: 'Deep emerald + rich black - dramatic, premium',
  },
  'botanical-cream': {
    name: 'Botanical Cream', 
    description: 'Forest green + warm cream - organic, inviting',
  },
} as const;

export function getTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'emerald-night';
  return (localStorage.getItem('viridis-theme') as ThemeMode) || 'emerald-night';
}

export function setTheme(theme: ThemeMode): void {
  localStorage.setItem('viridis-theme', theme);
  applyTheme(theme);
}

export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  
  // Remove existing theme classes
  root.classList.remove('theme-emerald-night', 'theme-botanical-cream');
  
  // Add new theme class
  root.classList.add(`theme-${theme}`);
  
  // Also toggle dark mode based on theme
  if (theme === 'emerald-night') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function initTheme(): void {
  const theme = getTheme();
  applyTheme(theme);
}
