// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      // Add any custom theme extensions here
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      // Default DaisyUI themes
      'light',
      'dark',
      'cupcake',
      'bumblebee',
      'emerald',
      'corporate',
      'synthwave',
      'retro',
      'cyberpunk',
      'valentine',
      'halloween',
      'garden',
      'forest',
      'aqua',
      'lofi',
      'pastel',
      'fantasy',
      'wireframe',
      'black',
      'luxury',
      'dracula',
      'cmyk',
      'autumn',
      'business',
      'acid',
      'lemonade',
      'night',
      'coffee',
      'winter',
      'dim',
      'nord',
      'sunset',
      // Custom CRM Theme
      {
        custom_crm_theme: {
          'primary': '#1d4ed8',       // Blue-600
          'primary-focus': '#1e40af',  // Blue-700
          'primary-content': '#ffffff',
          'secondary': '#7c3aed',     // Violet-600
          'secondary-focus': '#6d28d9', // Violet-700
          'secondary-content': '#ffffff',
          'accent': '#10b981',        // Emerald-500
          'accent-focus': '#059669',   // Emerald-600
          'accent-content': '#ffffff',
          'neutral': '#1f2937',       // Gray-800
          'neutral-focus': '#111827',  // Gray-900
          'neutral-content': '#f9fafb',// Gray-50
          'base-100': '#ffffff',       // White
          'base-200': '#f3f4f6',       // Gray-100
          'base-300': '#e5e7eb',       // Gray-200
          'base-content': '#111827',   // Gray-900
          'info': '#3b82f6',           // Blue-500
          'success': '#10b981',        // Emerald-500
          'warning': '#f59e0b',        // Amber-500
          'error': '#ef4444',          // Red-500
        },
      },
    ],
    darkTheme: 'dark', // Default dark theme
    base: true, // Applies background and text colors to root element by default
    styled: true, // Include DaisyUI colors and design decisions
    utils: true, // Add responsive and modifier utility classes
    prefix: '', // Prefix for DaisyUI class names (empty for no prefix)
    logs: true, // Show info about daisyUI version and used config in the console
  },
};

export default config;
