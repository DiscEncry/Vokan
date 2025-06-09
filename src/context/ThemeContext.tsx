"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useTheme as useNextTheme } from 'next-themes';

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

  // Remove user preferences logic for theme, only use next-themes
  const handleSetTheme = (newTheme: ThemeMode) => {
    setNextTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
