// src/components/ThemeToggle.tsx
'use client';

import { useTheme } from '@/hooks/useTheme';

// List of all available themes from your tailwind.config.ts
const ALL_THEMES = [
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
  'sunset'
] as const;

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  if (!resolvedTheme) return null;

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn m-1">
        {resolvedTheme}
        <svg width="12px" height="12px" className="h-2 w-2 fill-current opacity-60 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">
          <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path>
        </svg>
      </div>
      <ul tabIndex={0} className="dropdown-content z-[1] p-2 shadow-2xl bg-base-300 rounded-box w-52 max-h-[70vh] overflow-y-auto">
        {ALL_THEMES.map((theme) => (
          <li key={theme}>
            <button
              onClick={() => setTheme(theme)}
              className={`btn btn-ghost btn-sm justify-start w-full capitalize ${
                resolvedTheme === theme ? 'btn-active' : ''
              }`}
            >
              {theme}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}