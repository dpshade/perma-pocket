import { create } from 'zustand';
import { getTheme, saveTheme } from '@/core/storage/cache';
import { useEffect } from 'react';

interface ThemeState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const useTheme = create<ThemeState>((set) => ({
  theme: getTheme(),

  setTheme: (theme) => {
    saveTheme(theme);
    set({ theme });

    // Update document class
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      saveTheme(newTheme);

      // Update document class
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      return { theme: newTheme };
    });
  },
}));

// Hook to initialize theme on mount
export function useInitializeTheme() {
  const theme = useTheme((state) => state.theme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
}