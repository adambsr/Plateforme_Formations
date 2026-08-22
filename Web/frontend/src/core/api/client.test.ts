import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest } from './client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('uses the single API boundary with cookies and an in-memory bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest<{ ok: boolean }>(
        '/auth/me',
        { method: 'PUT', body: JSON.stringify({ firstName: 'Ada' }) },
        'access-token',
      ),
    ).resolves.toEqual({ ok: true });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);
    expect(options.credentials).toBe('include');
    expect(headers.get('authorization')).toBe('Bearer access-token');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('maps the backend error contract to ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request.',
              fieldErrors: [{ field: 'email', message: 'Invalid email.' }],
            },
          }),
          { status: 422, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const request = apiRequest('/auth/register', { method: 'POST' });
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request.',
      fieldErrors: [{ field: 'email', message: 'Invalid email.' }],
    });
  });
});
