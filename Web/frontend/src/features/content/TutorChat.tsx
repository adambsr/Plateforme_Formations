import { useRef, useState, type FormEvent } from 'react';
import botIcon from 'lucide-static/icons/bot.svg';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Icon } from '../../shared/components/Icon.js';
import { Select } from '../../shared/components/Select.js';
import type {
  TrainingContent,
  TutorCitation,
  TutorMode,
  TutorResponse,
} from './types.js';

interface ChatMessage {
  id: number;
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations?: TutorCitation[];
  grounded?: boolean;
  followUpQuestions?: string[];
}

const quickActions: Array<{
  mode: TutorMode;
  label: string;
  prompt: string;
}> = [
  {
    mode: 'SIMPLIFY',
    label: 'Expliquer simplement',
    prompt: 'Explique-moi simplement les notions importantes de cette leçon.',
  },
  {
    mode: 'SUMMARY',
    label: 'Résumer',
    prompt: 'Résume les points essentiels à retenir.',
  },
  {
    mode: 'EXAMPLE',
    label: 'Donner un exemple',
    prompt: 'Donne-moi un exemple concret basé sur le cours.',
  },
  {
    mode: 'PRACTICE',
    label: 'M’entraîner',
    prompt: 'Prépare quelques questions courtes pour vérifier ma compréhension.',
  },
  {
    mode: 'REVISION',
    label: 'Réviser',
    prompt: 'Aide-moi à réviser avant mon évaluation.',
  },
];

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'Le tuteur met trop de temps à répondre. Réessayez dans un instant.';
  return error instanceof ApiError
    ? error.message
    : 'Le tuteur est momentanément indisponible.';
}

export function TutorChat({ content }: { content: TrainingContent }) {
  const { request } = useAuth();
  const nextMessageId = useRef(1);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'ASSISTANT',
      content:
        'Bonjour ! Je réponds uniquement à partir de cette formation et je cite les leçons utilisées. Que souhaitez-vous travailler ?',
      grounded: true,
    },
  ]);
  const [draft, setDraft] = useState('');
  const [currentLessonId, setCurrentLessonId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(message: string, mode: TutorMode = 'QUESTION') {
    const trimmed = message.trim();
    if (trimmed.length < 2 || busy) return;
    const userMessage: ChatMessage = {
      id: nextMessageId.current++,
      role: 'USER',
      content: trimmed,
    };
    const history = messages
      .filter(({ id }) => id !== 0)
      .slice(-8)
      .map(({ role, content: previousContent }) => ({
        role,
        content: previousContent,
      }));
    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setBusy(true);
    setError('');
    const abortController = new AbortController();
    const timeout = window.setTimeout(() => abortController.abort(), 35_000);
    try {
      const response = await request<TutorResponse>(
        `/trainings/${content.trainingId}/tutor/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            message: trimmed,
            mode,
            ...(currentLessonId === '' ? {} : { currentLessonId }),
            conversation: history,
          }),
          signal: abortController.signal,
        },
      );
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId.current++,
          role: 'ASSISTANT',
          content: response.answer,
          citations: response.citations,
          grounded: response.grounded,
          followUpQuestions: response.followUpQuestions,
        },
      ]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <section className="content-card tutor-chat" aria-labelledby="tutor-title">
      <header className="tutor-header">
        <div className="tutor-title-row">
          <span className="tutor-icon" aria-hidden="true">
            <Icon src={botIcon} size={22} />
          </span>
          <div>
            <span className="eyebrow">Assistant pédagogique</span>
            <h2 id="tutor-title">Tuteur IA de la formation</h2>
          </div>
        </div>
        <p className="muted">
          Réponses limitées au contenu du cours, avec sources vérifiables.
        </p>
      </header>

      <label className="tutor-lesson-filter">
        Leçon à privilégier
        <Select
          value={currentLessonId}
          onChange={(event) => setCurrentLessonId(event.target.value)}
        >
          <option value="">Toute la formation</option>
          {content.modules.flatMap((module) =>
            module.lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {module.title} — {lesson.title}
              </option>
            )),
          )}
        </Select>
      </label>

      <div className="tutor-quick-actions" aria-label="Actions rapides du tuteur">
        {quickActions.map((action) => (
          <button
            key={action.mode}
            className="secondary-button compact-button"
            type="button"
            disabled={busy}
            onClick={() => void send(action.prompt, action.mode)}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="tutor-messages" aria-live="polite">
        {messages.map((chatMessage) => (
          <article
            key={chatMessage.id}
            className={`tutor-message tutor-message-${chatMessage.role.toLowerCase()}`}
          >
            <strong>
              {chatMessage.role === 'USER' ? 'Vous' : 'Tuteur IA'}
            </strong>
            <p>{chatMessage.content}</p>
            {chatMessage.grounded === false && (
              <small className="tutor-grounding-warning">
                Le contenu disponible ne permet pas de confirmer cette réponse.
              </small>
            )}
            {chatMessage.citations !== undefined &&
              chatMessage.citations.length > 0 && (
                <div className="tutor-citations">
                  <span className="tutor-chip-label">Sources du cours</span>
                  {chatMessage.citations.map((citation) => (
                    <a key={citation.lessonId} href={citation.href}>
                      {citation.moduleTitle} · {citation.lessonTitle}
                    </a>
                  ))}
                </div>
              )}
            {chatMessage.followUpQuestions !== undefined &&
              chatMessage.followUpQuestions.length > 0 && (
                <div className="tutor-follow-ups">
                  <span className="tutor-chip-label">Pour continuer</span>
                  {chatMessage.followUpQuestions.map((question) => (
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
        {busy && (
          <p className="tutor-thinking" role="status">
            Le tuteur recherche dans les leçons…
          </p>
        )}
      </div>

      {error !== '' && (
        <p className="form-error tutor-error" role="alert">
          {error}
        </p>
      )}
      <form className="tutor-composer" onSubmit={submit}>
        <label htmlFor="tutor-message">Votre question</label>
        <div>
          <textarea
            id="tutor-message"
            rows={2}
            maxLength={2_000}
            value={draft}
            placeholder="Ex. Peux-tu reformuler cette notion avec un exemple ?"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            className="primary-button"
            disabled={busy || draft.trim().length < 2}
          >
            Envoyer
          </button>
        </div>
      </form>
      <small className="tutor-disclaimer">
        L’IA peut se tromper : utilisez les liens de source pour vérifier dans le
        cours.
      </small>
    </section>
  );
}
