import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AnalyticsPageTracker } from './AnalyticsPageTracker.js';
import { trackPageView } from './firebase.js';

vi.mock('./firebase.js', () => ({ trackPageView: vi.fn() }));

function NavigateToCatalogue() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/catalogue?level=BEGINNER')}>Next</button>
  );
}

describe('AnalyticsPageTracker', () => {
  it('records the initial route and each client-side navigation', async () => {
    const view = render(
      <MemoryRouter initialEntries={['/']}>
        <AnalyticsPageTracker />
        <Routes>
          <Route path="/" element={<NavigateToCatalogue />} />
          <Route path="/catalogue" element={<p>Catalogue</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(trackPageView).toHaveBeenCalledWith('/');

    view.getByRole('button', { name: 'Next' }).click();

    await waitFor(() => {
      expect(trackPageView).toHaveBeenCalledWith('/catalogue?level=BEGINNER');
    });
  });
});
