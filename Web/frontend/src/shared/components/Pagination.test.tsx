import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination.js';

describe('Phase 12 pagination', () => {
  it('announces position and navigates without leaving valid bounds', () => {
    const change = vi.fn();
    render(
      <Pagination
        page={2}
        pageSize={10}
        total={25}
        onPageChange={change}
        label="Pages de test"
      />,
    );
    expect(
      screen.getByRole('navigation', { name: 'Pages de test' }),
    ).toHaveTextContent('Page 2 sur 3');
    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(change.mock.calls).toEqual([[1], [3]]);
  });
});
