import { ApiClient, ApiError } from '../src/core/api/client';

function response(status: number, body?: unknown): Response {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Mobile API client', () => {
  it('sends the in-memory access token and parses JSON', async () => {
    const fetcher = jest.fn(async () => response(200, { ok: true }));
    const client = new ApiClient('https://api.example.test/api', fetcher);

    await expect(
      client.request('/auth/me', {}, 'access-token'),
    ).resolves.toEqual({ ok: true });
    const [, options] = fetcher.mock.calls[0] ?? [];
    expect(new Headers(options?.headers).get('authorization')).toBe(
      'Bearer access-token',
    );
  });

  it('normalizes backend errors', async () => {
    const client = new ApiClient(
      'https://api.example.test/api',
      jest.fn(async () =>
        response(401, {
          error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect.' },
        }),
      ),
    );

    await expect(client.request('/auth/login')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'L’email ou le mot de passe est incorrect.',
    } satisfies Partial<ApiError>);
  });

  it('exposes interrupted connections as retryable network errors', async () => {
    const client = new ApiClient(
      'https://api.example.test/api',
      jest.fn(async () => Promise.reject(new Error('offline'))),
    );

    await expect(client.request('/trainings')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});
