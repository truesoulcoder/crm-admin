// src/hooks/useTheme.ts
import { useEffect, useState } from 'react';

export type ThemeName = 
  | 'light' | 'dark' | 'cupcake' | 'bumblebee' | 'emerald' 
  | 'corporate' | 'synthwave' | 'retro' | 'cyberpunk' | 'valentine' 
  | 'halloween' | 'garden' | 'forest' | 'aqua' | 'lofi' 
  | 'pastel' | 'fantasy' | 'wireframe' | 'black' | 'luxury' 
  | 'dracula' | 'cmyk' | 'autumn' | 'business' | 'acid' 
  | 'lemonade' | 'night' | 'coffee' | 'winter' | 'dim' | 'nord' | 'sunset';

export type Theme = ThemeName | 'system';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('night');
  const [resolvedTheme, setResolvedTheme] = useState<ThemeName>('night');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or use default
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme !== 'system') {
        setResolvedTheme(savedTheme);
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(isDark ? 'night' : 'light');
      }
    }
    setMounted(true);
  }, []);

  // Update theme when it changes
  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme !== 'system') {
      setResolvedTheme(newTheme);
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedTheme(isDark ? 'night' : 'light');
    }
  };

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setResolvedTheme(mediaQuery.matches ? 'night' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return {
    theme,
    setTheme: updateTheme,
    resolvedTheme,
    mounted,
  };
};