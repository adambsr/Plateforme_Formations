import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { DocumentTitle } from './DocumentTitle.js';

afterEach(() => {
  document.title = 'High Skills Academy';
});

describe('DocumentTitle', () => {
  it('sets a distinct title for each tracked SPA route', async () => {
    render(
      <MemoryRouter initialEntries={['/app/learner']}>
        <DocumentTitle />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.title).toBe('Espace apprenant | High Skills Academy');
    });
  });
});
