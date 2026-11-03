/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Futuristic Cinematic Intelligence Foundation
        obsidian: 'rgb(var(--bg-primary-rgb, 8 13 20) / <alpha-value>)',
        deepMidnight: 'rgb(var(--bg-surface-rgb, 11 23 36) / <alpha-value>)',
        deepOcean: 'rgb(var(--bg-surface-elevated-rgb, 16 43 58) / <alpha-value>)',
        tealAccent: 'rgb(var(--accent-primary-rgb, 22 199 194) / <alpha-value>)',
        electricCyan: 'rgb(var(--accent-secondary-rgb, 69 217 245) / <alpha-value>)',
        violetAccent: 'rgb(var(--accent-highlight-rgb, 129 117 255) / <alpha-value>)',
        softIce: '#D9F7F5',
        mutedSilver: '#A8BBC6',

        // Dynamic theme variable aliases
        charcoal: 'rgb(var(--bg-surface-rgb, 11 23 36) / <alpha-value>)',
        charcoalElevated: 'rgb(var(--bg-surface-elevated-rgb, 16 43 58) / <alpha-value>)',
        neonGreen: 'rgb(var(--accent-primary-rgb, 22 199 194) / <alpha-value>)',
        forestGreen: 'rgb(var(--accent-secondary-rgb, 69 217 245) / <alpha-value>)',
        themeHighlight: 'rgb(var(--accent-highlight-rgb, 129 117 255) / <alpha-value>)',
        themeGlow: 'rgb(var(--theme-glow-rgb, 22 199 194) / <alpha-value>)',

        offWhite: '#F8F8F8',
        lavender: '#8175FF',
        plum: '#4B337E',
        deepPurple: '#210635',
      },
      fontFamily: {
        sans: ['Inter', 'Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 8px var(--accent-primary, #16C7C2), 0 0 16px var(--accent-primary, #16C7C2)' },
          '100%': { boxShadow: '0 0 20px var(--accent-primary, #16C7C2), 0 0 35px var(--accent-primary, #16C7C2)' },
        }
      }
    },
  },
  plugins: [],
}
