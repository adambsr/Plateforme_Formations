import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Pagination } from '../../shared/components/Pagination.js';
import { Select } from '../../shared/components/Select.js';
import type { Enrollment } from '../payments/types.js';
import type {
  Attempt,
  Evaluation,
  Page,
  Question,
  ResultPage,
} from './types.js';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

const attemptStatusLabel = (status: Attempt['status']) =>
  ({ IN_PROGRESS: 'En cours', PASSED: 'Réussie', FAILED: 'Échouée' })[status];
const questionTypeLabel = (type: Question['type']) =>
  ({
    SINGLE_CHOICE: 'Choix unique',
    MULTIPLE_CHOICE: 'Choix multiple',
    TRUE_FALSE: 'Vrai ou faux',
  })[type];

export function EvaluationPage() {
  const { user, request } = useAuth();
  const [page, setPage] = useState<Page<Evaluation> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [selected, setSelected] = useState<Evaluation | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [results, setResults] = useState<ResultPage | null>(null);
  const [editingEvaluation, setEditingEvaluation] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const detail = useCallback(
    async (id: string) => {
      setError('');
      try {
        const value = await request<Evaluation>(`/evaluations/${id}`);
        setSelected(value);
        setAttempt(
          value.attempts?.find(({ status }) => status === 'IN_PROGRESS') ??
            value.attempts?.at(-1) ??
            null,
        );
        return value;
      } catch (caught) {
        setError(message(caught));
        return null;
      }
    },
    [request],
  );

  const load = useCallback(async () => {
    if (user === null) return;
    try {
      const view = user.role === 'LEARNER' ? 'ACCESSIBLE' : 'MANAGED';
      const values = await request<Page<Evaluation>>(
        `/evaluations?view=${view}${user.role === 'LEARNER' ? '&status=PUBLISHED' : ''}&page=${pageNumber}&pageSize=12`,
      );
      setPage(values);
      if (user.role === 'LEARNER')
        setEnrollments(
          (await request<Page<Enrollment>>('/enrollments?pageSize=100')).items,
        );
      setSelected(null);
      setAttempt(null);
    } catch (caught) {
      setError(message(caught));
    }
  }, [pageNumber, request, user]);

  useEffect(() => {
    // Route entry synchronizes role-filtered Evaluation state with the backend.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    if (attempt?.status !== 'IN_PROGRESS' || attempt.expiresAt === undefined)
      return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);
  useEffect(() => {
    if (selected === null) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && attempt?.status !== 'IN_PROGRESS') {
        setSelected(null);
        setResults(null);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [attempt?.status, selected]);

  async function action(run: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await run();
      setNotice(success);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }
  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected === null) return;
    const form = new FormData(event.currentTarget);
    const type = String(form.get('type'));
    const options =
      type === 'TRUE_FALSE'
        ? [
            { id: 'TRUE', text: 'Vrai' },
            { id: 'FALSE', text: 'Faux' },
          ]
        : String(form.get('options'))
            .split('\n')
            .map((text) => text.trim())
            .filter(Boolean)
            .map((text, index) => ({
              id: String.fromCharCode(65 + index),
              text,
            }));
    await action(async () => {
      await request(`/evaluations/${selected.id}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          prompt: String(form.get('prompt')),
          options,
          correctOptionIds: String(form.get('correct'))
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
          explanation: String(form.get('explanation')) || undefined,
          points: Number(form.get('points')),
          order: Number(form.get('order')),
        }),
      });
      event.currentTarget.reset();
      await detail(selected.id);
    }, 'Question ajoutée.');
  }
  async function deleteQuestion(question: Question) {
    if (selected === null) return;
    await action(async () => {
      await request(`/questions/${question.id}`, { method: 'DELETE' });
      await detail(selected.id);
    }, 'Question supprimée.');
  }
  async function evaluationAction(path: string, success: string) {
    if (selected === null) return;
    await action(async () => {
      await request(path, { method: 'POST' });
      await load();
      await detail(selected.id);
    }, success);
  }
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected === null) return;
    const form = new FormData(event.currentTarget);
    await action(async () => {
      const response = await request<{
        extraction: { skippedResources: unknown[] };
      }>(`/evaluations/${selected.id}/generate-ai`, {
        method: 'POST',
        body: JSON.stringify({
          questionCount: Number(form.get('count')),
          questionTypes: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'],
        }),
      });
      await load();
      await detail(selected.id);
      setNotice(
        `Questions IA importées en brouillon. ${response.extraction.skippedResources.length} ressource(s) ignorée(s).`,
      );
    }, 'Questions IA importées.');
  }
  async function editQuestion(
    question: Question,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (selected === null) return;
    const form = new FormData(event.currentTarget);
    const prompt = String(form.get('prompt'));
    const optionText = String(form.get('options'));
    const correct = String(form.get('correct'));
    const options =
      question.type === 'TRUE_FALSE'
        ? question.options
        : optionText.split('\n').map((text, index) => ({
            id: String.fromCharCode(65 + index),
            text: text.trim(),
          }));
    await action(async () => {
      await request(`/questions/${question.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          prompt,
          options,
          correctOptionIds: correct
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
          points: Number(form.get('points')),
        }),
      });
      await detail(selected.id);
      setEditingQuestionId(undefined);
    }, 'Question mise à jour.');
  }
  async function editEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected === null) return;
    const form = new FormData(event.currentTarget);
    await action(async () => {
      await request(`/evaluations/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: String(form.get('title')),
          passPercentage: Number(form.get('passPercentage')),
          maxAttempts: Number(form.get('maxAttempts')),
        }),
      });
      await load();
      await detail(selected.id);
      setEditingEvaluation(false);
    }, 'Évaluation mise à jour.');
  }
  async function deleteEvaluation() {
    if (selected === null) return;
    await action(async () => {
      await request(`/evaluations/${selected.id}`, { method: 'DELETE' });
      setSelected(null);
      await load();
    }, 'Brouillon supprimé.');
  }
  async function designate() {
    if (selected === null) return;
    await action(
      async () => {
        await request(
          `/trainings/${selected.training.id}/certifying-evaluation`,
          {
            method: 'PUT',
            body: JSON.stringify({
              evaluationId: selected.isCertifying ? null : selected.id,
            }),
          },
        );
        await load();
        await detail(selected.id);
      },
      selected.isCertifying
        ? 'Désignation retirée.'
        : 'Évaluation certifiante définie.',
    );
  }
  async function showResults() {
    if (selected === null) return;
    await action(
      async () =>
        setResults(
          await request<ResultPage>(`/evaluations/${selected.id}/results`),
        ),
      'Résultats actualisés.',
    );
  }
  async function startAttempt(evaluation: Evaluation) {
    if (evaluation.completed) {
      setError('Cette évaluation est déjà terminée.');
      return;
    }
    const enrollment = enrollments.find(
      ({ training }) => training.id === evaluation.training.id,
    );
    if (enrollment === undefined) {
      setError('Aucune inscription payée ne correspond à cette formation.');
      return;
    }
    await action(
      async () =>
        setAttempt(
          await request<Attempt>(`/evaluations/${evaluation.id}/attempts`, {
            method: 'POST',
            body: JSON.stringify({ enrollmentId: enrollment.id }),
          }),
        ),
      'Tentative démarrée.',
    );
  }
  async function selectEvaluation(evaluation: Evaluation) {
    if (user?.role !== 'LEARNER') {
      await detail(evaluation.id);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const value = await request<Evaluation>(`/evaluations/${evaluation.id}`);
      setSelected(value);
      const inProgress = value.attempts?.find(
        ({ status }) => status === 'IN_PROGRESS',
      );
      if (inProgress !== undefined) {
        setAttempt(inProgress);
        return;
      }
      if (value.completed) {
        setAttempt(value.attempts?.at(-1) ?? null);
        return;
      }
      const enrollment = enrollments.find(
        ({ training }) => training.id === value.training.id,
      );
      if (enrollment === undefined) {
        throw new Error(
          'Aucune inscription payée ne correspond à cette formation.',
        );
      }
      setAttempt(
        await request<Attempt>(`/evaluations/${value.id}/attempts`, {
          method: 'POST',
          body: JSON.stringify({ enrollmentId: enrollment.id }),
        }),
      );
    } catch (caught) {
      setSelected(null);
      setAttempt(null);
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }
  async function saveAnswer(
    answer: Attempt['answers'][number],
    selectedOptionIds: string[],
  ) {
    if (attempt === null) return;
    await action(
      async () =>
        setAttempt(
          await request<Attempt>(`/attempts/${attempt.id}/answers`, {
            method: 'PUT',
            body: JSON.stringify({
              questionId: answer.questionId,
              selectedOptionIds,
            }),
          }),
        ),
      'Réponse enregistrée.',
    );
  }
  async function submitAttempt() {
    if (attempt === null) return;
    await action(async () => {
      setAttempt(
        await request<Attempt>(`/attempts/${attempt.id}/submit`, {
          method: 'POST',
        }),
      );
      if (selected !== null) await detail(selected.id);
    }, 'Tentative corrigée.');
  }

  if (user === null) return null;
  const owner = user.role === 'TRAINER';
  const remaining =
    attempt?.expiresAt === undefined
      ? undefined
      : Math.max(
          0,
          Math.ceil((new Date(attempt.expiresAt).getTime() - now) / 1000),
        );
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Évaluation pédagogique</span>
          <h1>
            {user.role === 'ADMIN'
              ? 'Supervision des évaluations'
              : 'Mes évaluations'}
          </h1>
        </div>
        {page !== null && <span className="count-badge">{page.total}</span>}
        {owner && (
          <Link className="primary-button" to="/app/evaluations/new">
            Créer une nouvelle évaluation
          </Link>
        )}
      </div>
      {notice !== '' && <p className="success-message">{notice}</p>}
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {page === null && error === '' ? (
        <p className="muted">Chargement des évaluations…</p>
      ) : page?.items.length === 0 ? (
        <div className="empty-state">
          <h2>Aucune évaluation</h2>
          <p className="muted">Les évaluations disponibles apparaîtront ici.</p>
        </div>
      ) : (
        <div className="evaluation-layout">
          <aside className="evaluation-list">
            {page?.items.map((evaluation) => (
              <button
                key={evaluation.id}
                className={
                  selected?.id === evaluation.id
                    ? 'content-card selected-card'
                    : 'content-card'
                }
                onClick={() => void selectEvaluation(evaluation)}
              >
                <span className="eyebrow">{evaluation.training.title}</span>
                <strong>{evaluation.title}</strong>
                <small>
                  {evaluation.questionCount} question(s)
                  {evaluation.durationMinutes === undefined
                    ? ''
                    : ` · ${evaluation.durationMinutes} min`}
                </small>
                <span className="evaluation-list-action">
                  {user.role === 'LEARNER' && evaluation.completed
                    ? 'Terminé'
                    : 'Ouvrir →'}
                </span>
              </button>
            ))}
            {page !== null && (
              <Pagination
                page={page.page}
                pageSize={page.pageSize}
                total={page.total}
                onPageChange={setPageNumber}
                label="Pagination des évaluations"
              />
            )}
          </aside>
          {selected !== null && (
            <div
              className="evaluation-modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  attempt?.status !== 'IN_PROGRESS'
                ) {
                  setSelected(null);
                  setResults(null);
                }
              }}
            >
              <div
                className="evaluation-detail evaluation-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="evaluation-modal-title"
              >
                <button
                  type="button"
                  className="modal-close"
                  aria-label="Fermer l’évaluation"
                  disabled={attempt?.status === 'IN_PROGRESS'}
                  onClick={() => {
                    setSelected(null);
                    setResults(null);
                  }}
                >
                  ×
                </button>
                <article className="content-card">
                  {user.role !== 'LEARNER' && (
                    <span
                      className={`status-pill status-${selected.status.toLowerCase()}`}
                    >
                      {
                        {
                          DRAFT: 'Brouillon',
                          PUBLISHED: 'Publiée',
                          ARCHIVED: 'Archivée',
                        }[selected.status]
                      }
                    </span>
                  )}
                  {user.role === 'LEARNER' && selected.completed && (
                    <span className="status-pill status-completed">
                      Terminé
                    </span>
                  )}
                  <h2 id="evaluation-modal-title">{selected.title}</h2>
                  <p>{selected.instructions}</p>
                  <p>
                    <strong>{selected.passPercentage}%</strong> requis ·{' '}
                    {selected.maxAttempts} tentative(s)
                    {selected.durationMinutes === undefined
                      ? ''
                      : ` · ${selected.durationMinutes} min`}
                  </p>
                  {selected.isCertifying && (
                    <p className="success-message">Évaluation certifiante</p>
                  )}
                </article>
                {user.role !== 'LEARNER' && (
                  <div className="management-actions">
                    {owner && selected.status === 'DRAFT' && (
                      <>
                        <button
                          className="secondary-button compact-button"
                          disabled={busy}
                          onClick={() => setEditingEvaluation(true)}
                        >
                          Modifier les réglages
                        </button>
                        <button
                          className="primary-button compact-button"
                          disabled={busy}
                          onClick={() =>
                            void evaluationAction(
                              `/evaluations/${selected.id}/publish`,
                              'Évaluation publiée.',
                            )
                          }
                        >
                          Publier
                        </button>
                        <button
                          className="danger-button compact-button"
                          disabled={busy}
                          onClick={() => void deleteEvaluation()}
                        >
                          Supprimer le brouillon
                        </button>
                      </>
                    )}
                    {owner && selected.status === 'PUBLISHED' && (
                      <button
                        className="secondary-button compact-button"
                        disabled={busy}
                        onClick={() => void designate()}
                      >
                        {selected.isCertifying
                          ? 'Retirer la certification'
                          : 'Rendre certifiante'}
                      </button>
                    )}
                    {selected.status === 'PUBLISHED' && (
                      <button
                        className="danger-button compact-button"
                        disabled={busy}
                        onClick={() =>
                          void evaluationAction(
                            `/evaluations/${selected.id}/archive`,
                            'Évaluation archivée.',
                          )
                        }
                      >
                        Archiver
                      </button>
                    )}
                    <button
                      className="secondary-button compact-button"
                      disabled={busy}
                      onClick={() => void showResults()}
                    >
                      Voir les résultats
                    </button>
                  </div>
                )}
                {owner && selected.status === 'DRAFT' && editingEvaluation && (
                  <form
                    className="content-card evaluation-question-form"
                    onSubmit={(event) => void editEvaluation(event)}
                  >
                    <h3>Modifier les réglages</h3>
                    <label>
                      Titre
                      <input
                        name="title"
                        defaultValue={selected.title}
                        required
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Seuil de réussite (%)
                        <input
                          name="passPercentage"
                          type="number"
                          min="1"
                          max="100"
                          defaultValue={selected.passPercentage}
                          required
                        />
                      </label>
                      <label>
                        Nombre maximal de tentatives
                        <input
                          name="maxAttempts"
                          type="number"
                          min="1"
                          defaultValue={selected.maxAttempts}
                          required
                        />
                      </label>
                    </div>
                    <div className="management-actions">
                      <button className="primary-button" disabled={busy}>
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditingEvaluation(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
                {results !== null && (
                  <section className="content-card">
                    <h2>Résultats</h2>
                    <p>
                      {results.passedAttempts}/{results.totalAttempts}{' '}
                      tentative(s) réussie(s)
                    </p>
                    {results.items.length === 0 ? (
                      <p className="muted">Aucun résultat soumis.</p>
                    ) : (
                      <ul className="financial-list">
                        {results.items.map((result) => (
                          <li key={result.id}>
                            <div>
                              <strong>
                                {result.learner.firstName ??
                                  result.learner.email}
                              </strong>
                              <span>Tentative {result.attemptNumber}</span>
                            </div>
                            <span>
                              {result.scorePercentage}% ·{' '}
                              {attemptStatusLabel(result.status)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
                {owner && selected.status === 'DRAFT' && (
                  <>
                    <form
                      className="content-card inline-action"
                      onSubmit={(event) => void generate(event)}
                    >
                      <label>
                        Questions IA
                        <input
                          name="count"
                          type="number"
                          min="1"
                          max="20"
                          defaultValue="5"
                        />
                      </label>
                      <button
                        className="secondary-button compact-button"
                        disabled={busy}
                      >
                        Générer avec Gemini
                      </button>
                    </form>
                    <form
                      className="content-card evaluation-question-form"
                      onSubmit={(event) => void addQuestion(event)}
                    >
                      <h3>Ajouter une question</h3>
                      <label>
                        Type
                        <Select name="type">
                          <option value="SINGLE_CHOICE">Choix unique</option>
                          <option value="MULTIPLE_CHOICE">
                            Choix multiple
                          </option>
                          <option value="TRUE_FALSE">Vrai / faux</option>
                        </Select>
                      </label>
                      <label>
                        Énoncé
                        <textarea name="prompt" required />
                      </label>
                      <label>
                        Options, une par ligne
                        <textarea
                          name="options"
                          placeholder="Option A&#10;Option B"
                        />
                      </label>
                      <label>
                        Réponses correctes
                        <input
                          name="correct"
                          placeholder="A,B ou TRUE"
                          required
                        />
                      </label>
                      <div className="form-grid">
                        <label>
                          Points
                          <input
                            name="points"
                            type="number"
                            min="1"
                            defaultValue="1"
                            required
                          />
                        </label>
                        <label>
                          Ordre
                          <input
                            name="order"
                            type="number"
                            min="1"
                            defaultValue={selected.questionCount + 1}
                            required
                          />
                        </label>
                      </div>
                      <label>
                        Explication
                        <textarea name="explanation" />
                      </label>
                      <button
                        className="primary-button compact-button"
                        disabled={busy}
                      >
                        Ajouter
                      </button>
                    </form>
                  </>
                )}
                <div className="evaluation-questions">
                  {selected.questions?.map((question) => (
                    <article className="content-card" key={question.id}>
                      <small>
                        {questionTypeLabel(question.type)} · {question.points}{' '}
                        point(s)
                      </small>
                      <h3>
                        {question.order}. {question.prompt}
                      </h3>
                      <ul>
                        {question.options.map((option) => (
                          <li key={option.id}>
                            <strong>{option.id}</strong> — {option.text}
                          </li>
                        ))}
                      </ul>
                      {question.correctOptionIds !== undefined && (
                        <p className="muted">
                          Réponse : {question.correctOptionIds.join(', ')}
                        </p>
                      )}
                      {editingQuestionId === question.id && (
                        <form
                          className="evaluation-question-form"
                          onSubmit={(event) =>
                            void editQuestion(question, event)
                          }
                        >
                          <label>
                            Énoncé
                            <textarea
                              name="prompt"
                              defaultValue={question.prompt}
                              required
                            />
                          </label>
                          <label>
                            Options, une par ligne
                            <textarea
                              name="options"
                              defaultValue={question.options
                                .map(({ text }) => text)
                                .join('\n')}
                              required
                            />
                          </label>
                          <label>
                            Réponses correctes
                            <input
                              name="correct"
                              defaultValue={
                                question.correctOptionIds?.join(',') ?? ''
                              }
                              required
                            />
                          </label>
                          <label>
                            Points
                            <input
                              name="points"
                              type="number"
                              min="1"
                              defaultValue={question.points}
                              required
                            />
                          </label>
                          <div className="management-actions">
                            <button className="primary-button" disabled={busy}>
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setEditingQuestionId(undefined)}
                            >
                              Annuler
                            </button>
                          </div>
                        </form>
                      )}
                      {owner && selected.status === 'DRAFT' && (
                        <div className="management-actions">
                          <button
                            className="secondary-button compact-button"
                            disabled={busy}
                            onClick={() => setEditingQuestionId(question.id)}
                          >
                            Modifier
                          </button>
                          <button
                            className="danger-button compact-button"
                            disabled={busy}
                            onClick={() => void deleteQuestion(question)}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {user.role === 'LEARNER' &&
                  attempt === null &&
                  !selected.completed && (
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={() => void startAttempt(selected)}
                    >
                      Démarrer une nouvelle tentative
                    </button>
                  )}
                {user.role === 'LEARNER' && attempt !== null && (
                  <div className="attempt-panel content-card">
                    <div className="managed-training-heading">
                      <h2>Tentative {attempt.attemptNumber}</h2>
                      <span
                        className={`status-pill status-${attempt.status.toLowerCase()}`}
                      >
                        {attemptStatusLabel(attempt.status)}
                      </span>
                    </div>
                    {remaining !== undefined &&
                      attempt.status === 'IN_PROGRESS' && (
                        <p role="timer">
                          Temps serveur restant : {Math.floor(remaining / 60)}:
                          {String(remaining % 60).padStart(2, '0')}
                        </p>
                      )}
                    {attempt.answers.map((answer) => (
                      <fieldset
                        key={answer.questionId}
                        disabled={busy || attempt.status !== 'IN_PROGRESS'}
                      >
                        <legend>
                          {answer.question.order}. {answer.question.prompt}
                        </legend>
                        {answer.question.options.map((option) => {
                          const multiple =
                            answer.question.type === 'MULTIPLE_CHOICE';
                          return (
                            <label key={option.id}>
                              <input
                                type={multiple ? 'checkbox' : 'radio'}
                                name={answer.questionId}
                                checked={answer.selectedOptionIds.includes(
                                  option.id,
                                )}
                                onChange={(event) => {
                                  const values = multiple
                                    ? event.target.checked
                                      ? [...answer.selectedOptionIds, option.id]
                                      : answer.selectedOptionIds.filter(
                                          (id) => id !== option.id,
                                        )
                                    : [option.id];
                                  void saveAnswer(answer, values);
                                }}
                              />
                              {option.text}
                            </label>
                          );
                        })}
                        {answer.question.correctOptionIds !== undefined && (
                          <p className="success-message">
                            Bonne réponse :{' '}
                            {answer.question.correctOptionIds.join(', ')}
                            {answer.question.explanation === undefined
                              ? ''
                              : ` — ${answer.question.explanation}`}
                          </p>
                        )}
                      </fieldset>
                    ))}
                    {attempt.status === 'IN_PROGRESS' ? (
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void submitAttempt()}
                      >
                        Terminer la tentative
                      </button>
                    ) : (
                      <p
                        className={
                          attempt.status === 'PASSED'
                            ? 'success-message'
                            : 'form-error'
                        }
                      >
                        Score : {attempt.scorePercentage}% —{' '}
                        {attempt.status === 'PASSED' ? 'Réussi' : 'Échoué'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function EvaluationCreatePage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [trainings, setTrainings] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void request<Page<{ id: string; title: string }>>(
      '/trainings?view=MANAGED&pageSize=100',
    )
      .then((value) => setTrainings(value.items))
      .catch((caught) => setError(message(caught)));
  }, [request]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await request('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          trainingId: String(form.get('trainingId')),
          title: String(form.get('title')),
          instructions: String(form.get('instructions')),
          passPercentage: Number(form.get('passPercentage')),
          maxAttempts: Number(form.get('maxAttempts')),
          ...(String(form.get('durationMinutes')) === ''
            ? {}
            : { durationMinutes: Number(form.get('durationMinutes')) }),
        }),
      });
      navigate('/app/evaluations', {
        replace: true,
        state: { notice: 'Évaluation créée.' },
      });
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="management-editor-page">
      <Link to="/app/evaluations">← Retour aux évaluations</Link>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Évaluation pédagogique</span>
          <h1>Créer une nouvelle évaluation</h1>
        </div>
      </div>
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form
        className="content-card editor-form"
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Formation
          <Select name="trainingId" required>
            <option value="">Sélectionner</option>
            {trainings.map((training) => (
              <option key={training.id} value={training.id}>
                {training.title}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Titre
          <input name="title" required />
        </label>
        <label>
          Instructions
          <textarea name="instructions" rows={5} />
        </label>
        <div className="form-grid">
          <label>
            Seuil de réussite (%)
            <input
              name="passPercentage"
              type="number"
              min="1"
              max="100"
              defaultValue="70"
              required
            />
          </label>
          <label>
            Nombre maximal de tentatives
            <input
              name="maxAttempts"
              type="number"
              min="1"
              defaultValue="3"
              required
            />
          </label>
          <label>
            Durée en minutes (facultative)
            <input name="durationMinutes" type="number" min="1" />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary-button" disabled={busy}>
            {busy ? 'Création…' : 'Créer l’évaluation'}
          </button>
          <Link className="secondary-button" to="/app/evaluations">
            Annuler
          </Link>
        </div>
      </form>
    </section>
  );
}
