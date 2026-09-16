import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackToTop } from './BackToTop.js';

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 0,
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BackToTop', () => {
  it('respects reduced motion when returning to the top', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 600,
    });
    render(
      <MemoryRouter>
        <BackToTop />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retour en haut de la page' }),
    );
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('appears after scrolling and returns the visitor to the top', () => {
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 600,
    });

    render(
      <MemoryRouter>
        <BackToTop />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', {
      name: 'Retour en haut de la page',
    });
    fireEvent.click(button);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
