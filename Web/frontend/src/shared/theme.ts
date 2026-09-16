export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'hsa-theme';

export function storedTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme, persist = false): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (!persist) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The active theme still applies when storage is unavailable.
  }
}

export function initializeTheme(): Theme {
  const theme = storedTheme();
  applyTheme(theme);
  return theme;
}
