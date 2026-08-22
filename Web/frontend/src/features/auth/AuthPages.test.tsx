import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './AuthPages.js';

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));
afterEach(cleanup);

describe('Phase 12 authentication UI', () => {
  it('provides an accessible password visibility control and styled registration CTA', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    const password = screen.getByLabelText('Mot de passe');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(
      screen.getByRole('button', { name: 'Afficher mot de passe' }),
    );
    expect(password).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('link', { name: 'Créer un compte Apprenant' }),
    ).toHaveClass('secondary-button');
  });
});
