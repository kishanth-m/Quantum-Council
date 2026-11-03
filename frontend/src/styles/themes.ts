/**
 * frontend/src/styles/themes.ts
 *
 * Quantum Council Themes — Headlined by Cinematic Intelligence Interface
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  palette: [string, string, string, string, string, string]; // [bgPrimary, bgSurface, bgElevated, accentPrimary, accentSecondary, accentHighlight]
  glowHex: string;
}

export const CINEMATIC_TOKENS = {
  obsidian: '#080D14',
  deepMidnight: '#0B1724',
  deepOcean: '#102B3A',
  tealAccent: '#16C7C2',
  electricCyan: '#45D9F5',
  softIce: '#D9F7F5',
  mutedSilver: '#A8BBC6',
  violetAccent: '#8175FF',
};

export const THEMES: ThemeDefinition[] = [
  {
    id: 'quantum-cinematic',
    name: 'Cinematic Intelligence',
    category: 'Cinematic Sci-Fi',
    description: 'Obsidian void with abyssal ocean glass, electric cyan illumination & selective violet accents.',
    palette: ['#080D14', '#0B1724', '#102B3A', '#16C7C2', '#45D9F5', '#8175FF'],
    glowHex: '#16C7C2',
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    category: 'Bio-Organic',
    description: 'Deep woodland moss with warm parchment highlights and muted brass.',
    palette: ['#0B0F0D', '#1F2A1F', '#3E5A3F', '#8CA98C', '#D9C7A3', '#B08D57'],
    glowHex: '#8CA98C',
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    category: 'Oceanic Deep',
    description: 'Abyssal navy with vibrant cyan luminescence and molten amber glow.',
    palette: ['#0B132B', '#1C2541', '#3A506B', '#5BC0BE', '#F4D6B0', '#D97706'],
    glowHex: '#5BC0BE',
  },
  {
    id: 'deep-olive',
    name: 'Deep Olive',
    category: 'Botanical Military',
    description: 'Subdued tactical olive canopy with pale lichen and dark basalt.',
    palette: ['#0F1F17', '#1E3A2E', '#3E5A3F', '#6B7F67', '#C7CBB8', '#3D4337'],
    glowHex: '#6B7F67',
  },
  {
    id: 'warm-earth',
    name: 'Warm Earth',
    category: 'Terracotta',
    description: 'Smoked espresso and cedar hearth with soft sandstone luminescence.',
    palette: ['#1A120E', '#3A2418', '#6B4A2E', '#A88462', '#D5C4AE', '#4A4A46'],
    glowHex: '#A88462',
  },
  {
    id: 'cosmic-purple',
    name: 'Cosmic Purple',
    category: 'Nebula',
    description: 'Deep astral void with violet auroras and soft lilac iridescence.',
    palette: ['#0E0B1D', '#2A1E4D', '#5A3B8C', '#8B7CC7', '#C9C2E3', '#3A3A52'],
    glowHex: '#8B7CC7',
  },
  {
    id: 'neon-rose',
    name: 'Neon Rose',
    category: 'Cyberpunk Bloom',
    description: 'Velvet plum shadow with striking magenta lasers and radiant coral.',
    palette: ['#1A0F2E', '#3B1B4F', '#7A2E6F', '#D6598F', '#F4D7D4', '#FF6B6B'],
    glowHex: '#D6598F',
  },
  {
    id: 'violet-amber',
    name: 'Violet Amber',
    category: 'Twilight Horizon',
    description: 'Obsidian dusk with iris indigo and brilliant incandescent amber.',
    palette: ['#1A1A1F', '#2D2B55', '#6A5ACD', '#A678B9', '#F0D9B5', '#F4A62A'],
    glowHex: '#6A5ACD',
  },
  {
    id: 'slate-pink',
    name: 'Slate Pink',
    category: 'Monochrome Pop',
    description: 'Minimalist carbon slate with electric neon pink highlights.',
    palette: ['#121212', '#1F2937', '#334155', '#64748B', '#F1F5F9', '#EC4899'],
    glowHex: '#EC4899',
  },
  {
    id: 'teal-ember',
    name: 'Teal Ember',
    category: 'Combustion',
    description: 'Subterranean dark teal waters contrasted with blazing forge ember.',
    palette: ['#0A0F14', '#0F3D3E', '#2E6F73', '#7FB3B8', '#EADCC8', '#C6601F'],
    glowHex: '#7FB3B8',
  },
];

export const THEME_STORAGE_KEY = 'quantum-council-theme';
export const MOTION_STORAGE_KEY = 'quantum-council-motion';

export type MotionPreference = 'on' | 'reduced' | 'off';

export function hexToRgb(hex: string): string {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return '8, 13, 20';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export function getSavedTheme(): ThemeDefinition {
  const savedId = typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
  return THEMES.find((t) => t.id === savedId) || THEMES[0];
}

export function applyTheme(theme: ThemeDefinition) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const [bgPrimary, bgSurface, bgElevated, accentPrimary, accentSecondary, accentHighlight] = theme.palette;

  // Set hex CSS variables
  root.style.setProperty('--bg-primary', bgPrimary);
  root.style.setProperty('--bg-surface', bgSurface);
  root.style.setProperty('--bg-surface-elevated', bgElevated);
  root.style.setProperty('--accent-primary', accentPrimary);
  root.style.setProperty('--accent-secondary', accentSecondary);
  root.style.setProperty('--accent-highlight', accentHighlight);
  root.style.setProperty('--theme-glow', theme.glowHex);

  // Set RGB channel CSS variables so Tailwind /alpha opacity modifiers work dynamically
  root.style.setProperty('--bg-primary-rgb', hexToRgb(bgPrimary));
  root.style.setProperty('--bg-surface-rgb', hexToRgb(bgSurface));
  root.style.setProperty('--bg-surface-elevated-rgb', hexToRgb(bgElevated));
  root.style.setProperty('--accent-primary-rgb', hexToRgb(accentPrimary));
  root.style.setProperty('--accent-secondary-rgb', hexToRgb(accentSecondary));
  root.style.setProperty('--accent-highlight-rgb', hexToRgb(accentHighlight));
  root.style.setProperty('--theme-glow-rgb', hexToRgb(theme.glowHex));

  localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
}

export function getSavedMotion(): MotionPreference {
  if (typeof window === 'undefined') return 'on';
  const saved = localStorage.getItem(MOTION_STORAGE_KEY) as MotionPreference | null;
  if (saved && ['on', 'reduced', 'off'].includes(saved)) return saved;
  // Default to 'on' so the cinematic ambient background motion is visibly active
  return 'on';
}

export function setSavedMotion(pref: MotionPreference) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOTION_STORAGE_KEY, pref);
  window.dispatchEvent(new CustomEvent('motion-changed', { detail: pref }));
}
