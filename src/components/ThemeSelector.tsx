'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import type { Theme, ThemeName } from '@/hooks/useTheme';

interface ThemeGroupProps {
  title: string;
  themes: readonly ThemeName[];
  currentTheme: ThemeName;
  onSelect: (theme: Theme) => void;
}

const ThemeGroup = ({ 
  title, 
  themes, 
  currentTheme, 
  onSelect 
}: ThemeGroupProps) => (
  <div className="mb-4">
    <div className="text-xs font-semibold text-base-content/70 px-2 py-1">
      {title}
    </div>
    <div className="grid grid-cols-2 gap-1">
      {themes.map((themeName) => (
        <button
          key={themeName}
          onClick={() => onSelect(themeName)}
          className={`btn btn-sm btn-ghost justify-start text-sm capitalize ${
            currentTheme === themeName ? 'btn-active' : ''
          }`}
          data-theme={themeName}
        >
          <div 
            className="w-3 h-3 rounded-full mr-2"
            style={{
              background: themeName === 'light' || themeName === 'dark' 
                ? `linear-gradient(135deg, hsl(var(--b1) / 0.8) 0%, hsl(var(--b2) / 0.8) 100%)`
                : `linear-gradient(135deg, 
                    hsl(var(--${themeName}-primary) / 0.8) 0%, 
                    hsl(var(--${themeName}-secondary) / 0.8) 100%)`
            }}
          />
          {themeName}
          {currentTheme === themeName && (
            <span className="ml-auto badge badge-primary badge-xs">✓</span>
          )}
        </button>
      ))}
    </div>
  </div>
);

export default function ThemeSelector() {
  const { 
    theme, 
    setTheme, 
    resolvedTheme, 
    themeGroups 
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Get the appropriate icon based on the current theme
  const getThemeIcon = () => {
    if (theme === 'system') return <Monitor size={16} />;
    if (resolvedTheme === 'light') return <Sun size={16} />;
    return <Moon size={16} />;
  };

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-circle">
        {getThemeIcon()}
      </label>
      <div 
        tabIndex={0}
        className="dropdown-content z-[1] p-4 shadow-2xl bg-base-100 rounded-box w-80"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Theme</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setTheme('light')}
                className={`btn btn-sm btn-ghost ${theme === 'light' ? 'btn-active' : ''}`}
              >
                <Sun size={16} />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`btn btn-sm btn-ghost ${theme === 'dark' ? 'btn-active' : ''}`}
              >
                <Moon size={16} />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`btn btn-sm btn-ghost ${theme === 'system' ? 'btn-active' : ''}`}
              >
                <Monitor size={16} />
              </button>
            </div>
          </div>
          
          <div className="divider my-1"></div>
          
          <ThemeGroup
            title="Light Themes"
            themes={themeGroups.light}
            currentTheme={resolvedTheme}
            onSelect={setTheme}
          />
          
          <ThemeGroup
            title="Dark Themes"
            themes={themeGroups.dark}
            currentTheme={resolvedTheme}
            onSelect={setTheme}
          />
        </div>
      </div>
    </div>
  );
}
