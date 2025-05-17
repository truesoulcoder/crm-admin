'use client';

import React from 'react';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { useTheme, THEMES } from '@/hooks/useTheme';

type ThemeGroup = {
  label: string;
  themes: string[];
};

const THEME_GROUPS: ThemeGroup[] = [
  {
    label: 'Light',
    themes: ['light', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'pastel', 'fantasy', 'wireframe', 'cmyk', 'autumn', 'acid', 'lemonade', 'winter']
  },
  {
    label: 'Dark',
    themes: ['dark', 'synthwave', 'halloween', 'forest', 'black', 'luxury', 'dracula', 'business', 'night', 'coffee']
  },
  {
    label: 'Colorful',
    themes: ['retro', 'cyberpunk', 'valentine', 'garden', 'aqua', 'lofi']
  }
];

export default function ThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  const getThemeIcon = (themeName: string) => {
    if (themeName === 'system') return <Monitor size={16} className="mr-1" />;
    if (themeName === 'light') return <Sun size={16} className="mr-1" />;
    if (themeName === 'dark') return <Moon size={16} className="mr-1" />;
    return <Palette size={16} className="mr-1" />;
  };

  const getThemePreview = (themeName: string) => (
    <div 
      className="w-4 h-4 rounded-full border border-base-content/20"
      style={{
        background: `linear-gradient(135deg, 
          hsl(var(--${themeName}-primary) / 0.8) 0%, 
          hsl(var(--${themeName}-primary) / 0.6) 50%, 
          hsl(var(--${themeName}-secondary) / 0.8) 100%)`
      }}
    />
  );

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-sm">
        <Palette size={16} className="mr-1" />
        <span className="hidden sm:inline">Theme</span>
      </label>
      <div className="dropdown-content z-[1] p-2 shadow-2xl bg-base-300 rounded-box w-64 max-h-96 overflow-y-auto">
        <div className="p-2">
          <div className="font-bold text-sm mb-2 px-2">Select Theme</div>
          
          {/* System theme option */}
          <div className="mb-4">
            <button
              className={`w-full text-left p-2 rounded-lg flex items-center ${theme === 'system' ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
              onClick={() => setTheme('system')}
            >
              <Monitor size={16} className="mr-2" />
              <span>System</span>
              {theme === 'system' && <span className="ml-auto badge badge-primary badge-xs">Active</span>}
            </button>
          </div>

          {/* Theme groups */}
          {THEME_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="text-xs font-semibold text-base-content/50 px-2 mb-1">{group.label}</div>
              <div className="grid grid-cols-2 gap-2">
                {group.themes.map((t) => (
                  <button
                    key={t}
                    className={`flex items-center p-2 rounded-lg text-sm ${theme === t ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                    onClick={() => setTheme(t as any)}
                  >
                    {getThemePreview(t)}
                    <span className="ml-2 capitalize">{t}</span>
                    {theme === t && <span className="ml-auto badge badge-primary badge-xs">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
