export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: readonly FieldError[];

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: readonly FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has('content-type')
  ) {
    headers.set('content-type', 'application/json');
  }
  if (accessToken !== undefined)
    headers.set('authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json();
  if (!response.ok) {
    const payload = body as {
      error?: { code?: string; message?: string; fieldErrors?: FieldError[] };
    };
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'REQUEST_FAILED',
      payload.error?.message ?? 'La requête a échoué.',
      payload.error?.fieldErrors ?? [],
    );
  }
  return body as T;
}

export async function apiDownload(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<Blob> {
  const headers = new Headers(options.headers);
  if (accessToken !== undefined)
    headers.set('authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; fieldErrors?: FieldError[] };
    };
    throw new ApiError(
      response.status,
      body.error?.code ?? 'DOWNLOAD_FAILED',
      body.error?.message ?? 'Le téléchargement a échoué.',
      body.error?.fieldErrors ?? [],
    );
  }
  return await response.blob();
}
