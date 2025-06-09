"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextProps {
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  setTheme: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { setTheme: setNextTheme } = useNextTheme();
  const { preferences, updatePreference } = useUserPreferences();

  const handleSetTheme = (newTheme: ThemeMode) => {
    setNextTheme(newTheme);
    if (preferences.darkMode !== newTheme) {
      updatePreference('darkMode', newTheme).catch(console.error);
    }
  };

  return (
    <ThemeContext.Provider value={{ setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
