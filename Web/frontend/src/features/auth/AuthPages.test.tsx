import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoginPage, RegisterPage } from './AuthPages.js';

const loginMock = vi.fn();
const registerMock = vi.fn();
vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ login: loginMock, register: registerMock }),
}));
afterEach(() => {
  cleanup();
  loginMock.mockReset();
  registerMock.mockReset();
});

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

  it('submits only backend-accepted registration fields', async () => {
    registerMock.mockResolvedValue({ role: 'LEARNER' });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Prénom'), {
      target: { value: 'Ada' },
    });
    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'Lovelace' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'Password123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    const call = await vi.waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
      return registerMock.mock.calls[0]?.[0];
    });

    expect(call).toEqual({
      email: 'ada@example.com',
      password: 'Password123!',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(call).not.toHaveProperty('confirmPassword');
  });
});
