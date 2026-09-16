import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './SystemPages.js';

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ user: null }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('retries an ordinary render failure without reloading the page', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let failed = true;
  function Screen() {
    if (failed) throw new Error('Temporary rendering failure');
    return <h1>Recovered page</h1>;
  }
  render(
    <MemoryRouter>
      <AppErrorBoundary>
        <Screen />
      </AppErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByRole('alert')).toBeVisible();
  failed = false;
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  expect(screen.getByRole('heading', { name: 'Recovered page' })).toBeVisible();
});

it('reloads a stale page bundle only when the user chooses Retry', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const reload = vi.fn();
  const realWindow = window;
  vi.stubGlobal(
    'window',
    new Proxy(realWindow, {
      get(target, key) {
        return key === 'location' ? { reload } : Reflect.get(target, key);
      },
    }),
  );
  function StaleScreen(): never {
    throw new TypeError(
      'Failed to fetch dynamically imported module: /assets/previous-build.js',
    );
  }
  render(
    <MemoryRouter>
      <AppErrorBoundary>
        <StaleScreen />
      </AppErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByRole('alert')).toBeVisible();
  expect(reload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  expect(reload).toHaveBeenCalledTimes(1);
});
