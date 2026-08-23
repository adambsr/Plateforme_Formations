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
    super(localizedApiMessage(status, code, message));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function localizedApiMessage(
  status: number,
  code: string,
  message: string,
): string {
  const known: Record<string, string> = {
    VALIDATION_FAILED: 'Certaines données saisies sont invalides.',
    AUTHENTICATION_REQUIRED: 'Connectez-vous pour continuer.',
    PASSWORD_CHANGE_REQUIRED:
      'Modifiez votre mot de passe temporaire pour continuer.',
    RATE_LIMITED: 'Trop de tentatives. Veuillez réessayer plus tard.',
    ROUTE_NOT_FOUND: 'La ressource demandée est introuvable.',
    INTERNAL_ERROR: 'Une erreur interne est survenue.',
    STRIPE_CHECKOUT_FAILED:
      'Le paiement n’a pas pu être préparé. Veuillez réessayer.',
    STRIPE_EUR_NOT_ENABLED:
      'La Sandbox Stripe configurée refuse le EUR. Vérifiez que la clé backend appartient à la Sandbox où le EUR est activé.',
    STRIPE_TEST_KEY_REQUIRED:
      'Le backend de développement doit utiliser une clé secrète Stripe sk_test_.',
    AI_PROVIDER_BUSY:
      'Gemini est temporairement très sollicité. Réessayez dans un instant.',
  };
  if (known[code] !== undefined) return known[code];
  const appearsEnglish =
    /\b(the|this|that|only|cannot|must|required|invalid|failed|does not|training|trainer|learner|session|payment|evaluation|category)\b/i.test(
      message,
    );
  if (!appearsEnglish) return message;
  if (status === 400 || status === 422)
    return 'Les données de la requête sont invalides.';
  if (status === 401) return 'Connectez-vous pour continuer.';
  if (status === 403)
    return 'Vous n’êtes pas autorisé à effectuer cette action.';
  if (status === 404) return 'L’élément demandé est introuvable.';
  if (status === 409)
    return 'Cette action est incompatible avec l’état actuel de l’élément.';
  if (status >= 500)
    return 'Le service est momentanément indisponible. Veuillez réessayer.';
  return message;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export function apiAssetUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
}

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
