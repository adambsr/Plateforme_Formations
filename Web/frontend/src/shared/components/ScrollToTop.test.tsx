import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ScrollToTop } from './ScrollToTop.js';

function NavigateToNextPage() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/next')}>Next</button>;
}

describe('ScrollToTop', () => {
  it('resets document scroll when the route changes', async () => {
    document.documentElement.scrollTop = 420;
    document.body.scrollTop = 420;
    const view = render(
      <MemoryRouter initialEntries={['/current']}>
        <ScrollToTop />
        <Routes>
          <Route path="/current" element={<NavigateToNextPage />} />
          <Route path="/next" element={<p>Next page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    view.getByRole('button', { name: 'Next' }).click();
    expect(await view.findByText('Next page')).toBeInTheDocument();
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });
});
