import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle.js';

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
  window.localStorage.clear();
  vi.restoreAllMocks();
});

it('defaults to light and persists an explicit theme choice', () => {
  const { unmount } = render(<ThemeToggle />);
  expect(
    screen.getByRole('button', { name: 'Activer le thème sombre' }),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Activer le thème sombre' }),
  );
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(window.localStorage.getItem('hsa-theme')).toBe('dark');
  unmount();
  render(<ThemeToggle />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Activer le thème clair' }),
  );
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(window.localStorage.getItem('hsa-theme')).toBe('light');
});
