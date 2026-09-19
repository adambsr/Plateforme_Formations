import { appConfig } from '../config/environment';

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
    ACCOUNT_UNAVAILABLE: 'Ce compte n’est pas disponible.',
    AUTHENTICATION_REQUIRED: 'Connectez-vous pour continuer.',
    CURRENT_PASSWORD_INCORRECT: 'Le mot de passe actuel est incorrect.',
    EMAIL_ALREADY_EXISTS: 'Un compte utilise déjà cet email.',
    INVALID_CREDENTIALS: 'L’email ou le mot de passe est incorrect.',
    INVALID_PASSWORD_RESET_TOKEN:
      'Le lien de réinitialisation est invalide ou expiré.',
    INVALID_REFRESH_TOKEN: 'Votre session a expiré. Reconnectez-vous.',
    PASSWORD_CHANGE_REQUIRED:
      'Modifiez votre mot de passe temporaire pour continuer.',
    RATE_LIMITED: 'Trop de tentatives. Réessayez plus tard.',
    REFRESH_TOKEN_EXPIRED: 'Votre session a expiré. Reconnectez-vous.',
    REFRESH_TOKEN_REUSED: 'Votre session a été révoquée. Reconnectez-vous.',
    VALIDATION_FAILED: 'Certaines données saisies sont invalides.',
    ROUTE_NOT_FOUND: 'La ressource demandée est introuvable.',
    INTERNAL_ERROR: 'Une erreur interne est survenue.',
    AI_PROVIDER_BUSY:
      'Gemini est temporairement très sollicité. Réessayez dans un instant.',
    AI_PROVIDER_UNAVAILABLE:
      'Gemini est temporairement indisponible. Réessayez dans quelques instants.',
    AI_PROVIDER_RATE_LIMITED:
      'Gemini a atteint sa limite temporaire. Réessayez dans quelques instants.',
    AI_PROVIDER_CONFIGURATION_ERROR:
      'La configuration Gemini du serveur a été refusée. Contactez un administrateur.',
    AI_PROVIDER_MODEL_UNAVAILABLE:
      'Le modèle Gemini configuré est indisponible. Contactez un administrateur.',
    AI_RESPONSE_INVALID:
      'Gemini a renvoyé une réponse illisible. Aucune question n’a été enregistrée.',
    AI_RESPONSE_SCHEMA_INVALID:
      'Gemini a renvoyé des questions invalides. Aucune question n’a été enregistrée.',
    NO_EXTRACTABLE_TRAINING_TEXT:
      'Aucun contenu textuel exploitable n’est disponible pour générer cette évaluation.',
    NO_TUTOR_COURSE_TEXT:
      'Aucun contenu textuel exploitable n’est disponible pour le Tuteur IA.',
    FILE_TOO_LARGE: 'Le fichier dépasse la taille maximale autorisée.',
    INVALID_MULTIPART_UPLOAD: 'Le fichier envoyé n’est pas valide.',
    CONTENT_ORDER_ALREADY_USED:
      'Cet ordre est déjà utilisé. Choisissez un autre numéro.',
    TRAINING_HAS_HISTORY:
      'Cette formation possède un historique et doit être archivée plutôt que supprimée.',
    EVALUATION_ALREADY_COMPLETED:
      'Cette évaluation est déjà terminée et ne peut pas être recommencée.',
    STRIPE_CHECKOUT_FAILED:
      'Le paiement n’a pas pu être préparé. Veuillez réessayer.',
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
    return 'Le service est momentanément indisponible. Réessayez.';
  return 'La requête n’a pas pu aboutir. Réessayez.';
}

type FetchImplementation = typeof fetch;

export class ApiClient {
  readonly #baseUrl: string;
  readonly #fetch: FetchImplementation;

  constructor(
    baseUrl: string,
    fetchImplementation: FetchImplementation = fetch,
  ) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#fetch = fetchImplementation;
  }

  async request<T>(
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
    if (accessToken !== undefined) {
      headers.set('authorization', `Bearer ${accessToken}`);
    }

    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed.');
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    let body: unknown;
    try {
      body = text.length === 0 ? undefined : JSON.parse(text);
    } catch {
      throw new ApiError(
        response.status,
        'INVALID_API_RESPONSE',
        'Le serveur a renvoyé une réponse invalide.',
      );
    }

    if (!response.ok) {
      const payload = body as {
        error?: { code?: string; message?: string; fieldErrors?: FieldError[] };
      };
      throw new ApiError(
        response.status,
        payload?.error?.code ?? 'REQUEST_FAILED',
        payload?.error?.message ?? 'La requête a échoué.',
        payload?.error?.fieldErrors ?? [],
      );
    }
    return body as T;
  }
}

export const apiClient = new ApiClient(appConfig.apiBaseUrl);

export function apiAssetUrl(path: string): string {
  return /^https?:\/\//i.test(path)
    ? path
    : `${appConfig.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
