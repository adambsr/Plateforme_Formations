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
  _message: string,
): string {
  const known: Record<string, string> = {
    ACCOUNT_UNAVAILABLE: 'Ce compte est désactivé ou n’est plus disponible.',
    CURRENT_PASSWORD_INCORRECT: 'Le mot de passe actuel est incorrect.',
    EMAIL_ALREADY_EXISTS: 'Un compte utilise déjà cet email.',
    INVALID_CREDENTIALS: 'L’email ou le mot de passe est incorrect.',
    INVALID_PASSWORD_RESET_TOKEN:
      'Le lien de réinitialisation est invalide ou expiré.',
    INVALID_REFRESH_TOKEN: 'Votre session a expiré. Reconnectez-vous.',
    REFRESH_TOKEN_EXPIRED: 'Votre session a expiré. Reconnectez-vous.',
    REFRESH_TOKEN_REUSED: 'Votre session a été révoquée. Reconnectez-vous.',
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
    AI_PROVIDER_UNAVAILABLE:
      'Gemini est temporairement indisponible ou tr\u00e8s sollicit\u00e9. R\u00e9essayez dans quelques instants.',
    AI_PROVIDER_RATE_LIMITED:
      'Gemini a temporairement atteint sa limite de requ\u00eates. R\u00e9essayez dans quelques instants.',
    AI_PROVIDER_CONFIGURATION_ERROR:
      'La configuration Gemini du serveur a \u00e9t\u00e9 refus\u00e9e. Contactez un administrateur.',
    AI_PROVIDER_MODEL_UNAVAILABLE:
      'Le mod\u00e8le Gemini configur\u00e9 est indisponible. Contactez un administrateur.',
    AI_RESPONSE_INVALID:
      'Gemini a renvoy\u00e9 une r\u00e9ponse illisible. Aucune question n\u2019a \u00e9t\u00e9 enregistr\u00e9e ; r\u00e9essayez.',
    AI_RESPONSE_SCHEMA_INVALID:
      'Gemini a renvoy\u00e9 des questions incompl\u00e8tes ou invalides. Aucune question n\u2019a \u00e9t\u00e9 enregistr\u00e9e ; r\u00e9essayez.',
    CONTENT_ORDER_ALREADY_USED:
      'Cet ordre est d\u00e9j\u00e0 utilis\u00e9 dans cette formation. Choisissez un autre num\u00e9ro.',
    TRAINING_HAS_HISTORY:
      'Cette formation possède un historique et ne peut pas être supprimée. Archivez-la pour conserver les inscriptions, paiements et résultats.',
    EVALUATION_ALREADY_COMPLETED:
      'Cette évaluation est déjà complétée. Une évaluation réussie ne peut pas être recommencée.',
  };
  if (known[code] !== undefined) return known[code];
  if (status === 0)
    return 'Connexion impossible. Vérifiez votre accès réseau puis réessayez.';
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
  return 'La requête n’a pas pu aboutir. Veuillez réessayer.';
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export interface ApiStreamEvent<T = unknown> {
  id?: string;
  type: string;
  data: T;
}

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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed.');
  }
  if (response.status === 204) return undefined as T;
  let body: unknown;
  try {
    const text = await response.text();
    body = text.length === 0 ? undefined : JSON.parse(text);
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_API_RESPONSE',
      'The server returned an invalid response.',
    );
  }
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
    let body: {
      error?: { code?: string; message?: string; fieldErrors?: FieldError[] };
    };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new ApiError(
        response.status,
        'INVALID_API_RESPONSE',
        'The server returned an invalid response.',
      );
    }
    throw new ApiError(
      response.status,
      body.error?.code ?? 'DOWNLOAD_FAILED',
      body.error?.message ?? 'Le téléchargement a échoué.',
      body.error?.fieldErrors ?? [],
    );
  }
  return await response.blob();
}

export async function apiEventStream<T>(
  path: string,
  signal: AbortSignal,
  onEvent: (event: ApiStreamEvent<T>) => void,
  accessToken?: string,
): Promise<void> {
  const headers = new Headers({ accept: 'text/event-stream' });
  if (accessToken !== undefined)
    headers.set('authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    let body: {
      error?: { code?: string; message?: string; fieldErrors?: FieldError[] };
    } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      // A proxy may return a non-JSON error before the request reaches the API.
    }
    throw new ApiError(
      response.status,
      body.error?.code ?? 'STREAM_CONNECTION_FAILED',
      body.error?.message ?? 'The event stream could not be opened.',
      body.error?.fieldErrors ?? [],
    );
  }
  if (response.body === null) {
    throw new ApiError(
      0,
      'STREAM_UNAVAILABLE',
      'The browser did not expose a readable event stream.',
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer = `${buffer}${decoder.decode(value, { stream: !done })}`.replaceAll(
      '\r\n',
      '\n',
    );
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const fields = block.split('\n').filter((line) => !line.startsWith(':'));
      let type = 'message';
      let id: string | undefined;
      const data: string[] = [];
      for (const line of fields) {
        const separator = line.indexOf(':');
        const field = separator < 0 ? line : line.slice(0, separator);
        const fieldValue =
          separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '');
        if (field === 'event') type = fieldValue;
        else if (field === 'id') id = fieldValue;
        else if (field === 'data') data.push(fieldValue);
      }
      if (data.length > 0) {
        const rawData = data.join('\n');
        let parsed: unknown = rawData;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          // SSE permits plain-text data as well as JSON payloads.
        }
        onEvent({
          type,
          data: parsed as T,
          ...(id === undefined ? {} : { id }),
        });
      }
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
}
