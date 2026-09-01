import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useLocation } from 'react-router';
import botIcon from 'lucide-static/icons/bot.svg';
import sendIcon from 'lucide-static/icons/send-horizontal.svg';
import xIcon from 'lucide-static/icons/x.svg';

import { apiRequest, ApiError } from '../../core/api/client.js';
import { Icon } from '../../shared/components/Icon.js';

interface ConciergeLink {
  label: string;
  href: string;
}

interface ConciergeResponse {
  answer: string;
  grounded: boolean;
  sources: Array<{ id: string; title: string; href: string }>;
  actions: ConciergeLink[];
  suggestedQuestions: string[];
}

interface ConciergeMessage {
  id: number;
  role: 'USER' | 'ASSISTANT';
  content: string;
  grounded?: boolean;
  sources?: ConciergeResponse['sources'];
  actions?: ConciergeLink[];
  suggestedQuestions?: string[];
}

const initialSuggestions = [
  'Quelles formations proposez-vous ?',
  'Comment créer un compte ?',
  'Comment fonctionne le paiement ?',
] as const;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429)
    return 'Vous avez envoyé plusieurs messages. Réessayez dans quelques minutes.';
  return error instanceof ApiError
    ? error.message
    : 'L’assistant est momentanément indisponible.';
}

export function PublicConcierge() {
  const location = useLocation();
  const nextMessageId = useRef(1);
  const messageEnd = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ConciergeMessage[]>([
    {
      id: 0,
      role: 'ASSISTANT',
      content:
        'Bonjour 👋 Je peux vous aider à découvrir nos formations et à trouver les bonnes pages. Que recherchez-vous ?',
      grounded: true,
    },
  ]);

  useEffect(() => {
    if (open) {
      messageEnd.current?.scrollIntoView({ behavior: 'smooth' });
      input.current?.focus();
    }
  }, [messages, busy, open]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (trimmed.length < 2 || busy) return;
    const userMessage: ConciergeMessage = {
      id: nextMessageId.current++,
      role: 'USER',
      content: trimmed,
    };
    const conversation = messages
      .filter(({ id }) => id !== 0)
      .slice(-4)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setBusy(true);
    setError('');
    try {
      const response = await apiRequest<ConciergeResponse>(
        '/public/concierge/messages',
        {
          method: 'POST',
          body: JSON.stringify({
            message: trimmed,
            currentPath: location.pathname,
            conversation,
            ...(website === '' ? {} : { website }),
          }),
        },
      );
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId.current++,
          role: 'ASSISTANT',
          content: response.answer,
          grounded: response.grounded,
          sources: response.sources,
          actions: response.actions,
          suggestedQuestions: response.suggestedQuestions,
        },
      ]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <aside className="public-concierge">
      {open && (
        <section
          className="public-concierge-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="public-concierge-title"
        >
          <header className="public-concierge-header">
            <span className="public-concierge-avatar" aria-hidden="true">
              <Icon src={botIcon} size={24} />
            </span>
            <div>
              <strong id="public-concierge-title">Assistant HSA</strong>
              <small>Informations publiques uniquement</small>
            </div>
            <button
              type="button"
              aria-label="Fermer l’assistant"
              onClick={() => setOpen(false)}
            >
              <Icon src={xIcon} size={20} />
            </button>
          </header>

          <div className="public-concierge-messages" aria-live="polite">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`public-concierge-message public-concierge-message-${message.role.toLowerCase()}`}
              >
                <span>{message.role === 'USER' ? 'Vous' : 'Assistant HSA'}</span>
                <p>{message.content}</p>
                {message.grounded === false && (
                  <small>
                    Je ne peux pas confirmer cela avec les informations publiques
                    disponibles.
                  </small>
                )}
                {message.sources !== undefined && message.sources.length > 0 && (
                  <div className="public-concierge-sources">
                    <span className="public-concierge-chip-label">
                      Sources publiques
                    </span>
                    {message.sources.map((source) => (
                      <Link key={source.id} to={source.href}>
                        {source.title}
                      </Link>
                    ))}
                  </div>
                )}
                {message.actions !== undefined && message.actions.length > 0 && (
                  <div className="public-concierge-actions">
                    {message.actions.map((action) => (
                      <Link key={`${action.href}-${action.label}`} to={action.href}>
                        {action.label} <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                )}
                {message.suggestedQuestions !== undefined &&
                  message.suggestedQuestions.length > 0 && (
                    <div className="public-concierge-suggestions">
                      <span className="public-concierge-chip-label">
                        Pour continuer
                      </span>
                      {message.suggestedQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          disabled={busy}
                          onClick={() => void send(question)}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
              </article>
            ))}
            {messages.length === 1 && (
              <div className="public-concierge-suggestions public-concierge-starters">
                {initialSuggestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={busy}
                    onClick={() => void send(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <p className="public-concierge-thinking" role="status">
                Je consulte les informations publiques…
              </p>
            )}
            <div ref={messageEnd} />
          </div>

          {error !== '' && (
            <p className="public-concierge-error" role="alert">
              {error}
            </p>
          )}
          <form className="public-concierge-composer" onSubmit={submit}>
            <label className="public-concierge-honeypot" aria-hidden="true">
              Site web
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
            <label className="sr-only" htmlFor="public-concierge-message">
              Votre question
            </label>
            <textarea
              ref={input}
              id="public-concierge-message"
              rows={1}
              maxLength={1_000}
              value={draft}
              placeholder="Posez votre question…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (draft.trim().length >= 2) void send(draft);
                }
              }}
            />
            <button
              type="submit"
              aria-label="Envoyer"
              disabled={busy || draft.trim().length < 2}
            >
              <Icon src={sendIcon} size={19} />
            </button>
          </form>
          <small className="public-concierge-disclaimer">
            Votre question est traitée par Gemini. Ne partagez ni mot de passe
            ni données bancaires. L’IA peut se tromper.
          </small>
        </section>
      )}
      <button
        className="public-concierge-launcher"
        type="button"
        aria-label={open ? 'Fermer l’assistant HSA' : 'Ouvrir l’assistant HSA'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon src={open ? xIcon : botIcon} size={27} />
        {!open && <span>Besoin d’aide ?</span>}
      </button>
    </aside>
  );
}
