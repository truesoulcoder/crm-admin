// src/hooks/useTheme.ts
'use client';

import { useEffect, useState } from 'react';

export type ThemeName = 
  | 'light' | 'dark' | 'night' | 'synthwave' | 'retro' 
  | 'cyberpunk' | 'valentine' | 'halloween' | 'garden' 
  | 'forest' | 'aqua' | 'lofi' | 'pastel' | 'fantasy' 
  | 'wireframe' | 'black' | 'luxury' | 'dracula' | 'cmyk' 
  | 'autumn' | 'business' | 'acid' | 'lemonade' | 'coffee' 
  | 'winter' | 'dim' | 'nord' | 'sunset';

export type Theme = ThemeName | 'system';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('night');
  const [resolvedTheme, setResolvedTheme] = useState<ThemeName>('night');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or use default
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const initialTheme = savedTheme || 'night';
    
    setTheme(initialTheme);
    
    if (initialTheme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedTheme(isDark ? 'night' : 'light');
    } else {
      setResolvedTheme(initialTheme);
    }
    
    setMounted(true);
  }, []);

  // Update theme when it changes
  const updateTheme = (newTheme: Theme) => {
    if (typeof window === 'undefined') return;
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedTheme(isDark ? 'night' : 'light');
    } else {
      setResolvedTheme(newTheme);
    }
  };

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;

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
    resolvedTheme: mounted ? resolvedTheme : 'night',
    mounted,
  };
};