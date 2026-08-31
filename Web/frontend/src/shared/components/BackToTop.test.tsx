import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackToTop } from './BackToTop.js';

afterEach(() => {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 0,
  });
  vi.restoreAllMocks();
});

describe('BackToTop', () => {
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
