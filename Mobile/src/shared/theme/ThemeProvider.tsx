import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';

export type AppTheme = 'light' | 'dark';

const storageKey = 'hsa-theme';

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: async () => undefined,
  toggleTheme: async () => undefined,
});

function applyTheme(theme: AppTheme) {
  Appearance.setColorScheme(theme);
}

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(storageKey)
      .then((stored) => {
        if (!active) return;
        const savedTheme: AppTheme = stored === 'dark' ? 'dark' : 'light';
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const setTheme = useCallback(async (next: AppTheme) => {
    applyTheme(next);
    setThemeState(next);
    await SecureStore.setItemAsync(storageKey, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components
export const useAppTheme = () => useContext(ThemeContext);
