import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, storedTheme } from '../theme.js';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => storedTheme() === 'dark');
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={dark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      title={dark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      onClick={() => {
        const nextTheme = dark ? 'light' : 'dark';
        applyTheme(nextTheme, true);
        setDark(nextTheme === 'dark');
      }}
    >
      {dark ? (
        <Sun size={19} aria-hidden="true" />
      ) : (
        <Moon size={19} aria-hidden="true" />
      )}
    </button>
  );
}
