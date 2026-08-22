import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
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

export function EvaluationPage() {
  const { user, request } = useAuth();
  const [page, setPage] = useState<Page<Evaluation> | null>(null);
  const [selected, setSelected] = useState<Evaluation | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [managedTrainings, setManagedTrainings] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [results, setResults] = useState<ResultPage | null>(null);
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
      } catch (caught) {
        setError(message(caught));
      }
    },
    [request],
  );

  const load = useCallback(async () => {
    if (user === null) return;
    try {
      const view = user.role === 'LEARNER' ? 'ACCESSIBLE' : 'MANAGED';
      const values = await request<Page<Evaluation>>(
        `/evaluations?view=${view}&pageSize=100`,
      );
      setPage(values);
      if (user.role === 'TRAINER') {
        const trainingPage = await request<Page<{ id: string; title: string }>>(
          '/trainings?view=MANAGED&pageSize=100',
        );
        setManagedTrainings(trainingPage.items);
      }
      if (user.role === 'LEARNER')
        setEnrollments(
          (await request<Page<Enrollment>>('/enrollments?pageSize=100')).items,
        );
      if (values.items[0] !== undefined) await detail(values.items[0].id);
      else setSelected(null);
    } catch (caught) {
      setError(message(caught));
    }
  }, [detail, request, user]);

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
  async function createEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(async () => {
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
      event.currentTarget.reset();
      await load();
    }, 'Évaluation créée.');
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
      await detail(selected.id);
      setNotice(
        `Questions IA importées en brouillon. ${response.extraction.skippedResources.length} ressource(s) ignorée(s).`,
      );
    }, 'Questions IA importées.');
  }
  async function editQuestion(question: Question) {
    if (selected === null) return;
    const prompt = window.prompt('Énoncé', question.prompt);
    if (prompt === null) return;
    const optionText = window.prompt(
      'Options, séparées par |',
      question.options.map(({ text }) => text).join('|'),
    );
    if (optionText === null) return;
    const correct = window.prompt(
      'Identifiants corrects, séparés par ,',
      question.correctOptionIds?.join(',') ?? '',
    );
    if (correct === null) return;
    const points = window.prompt('Points', String(question.points));
    if (points === null) return;
    const options =
      question.type === 'TRUE_FALSE'
        ? question.options
        : optionText.split('|').map((text, index) => ({
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
          points: Number(points),
        }),
      });
      await detail(selected.id);
    }, 'Question mise à jour.');
  }
  async function editEvaluation() {
    if (selected === null) return;
    const title = window.prompt('Titre', selected.title);
    if (title === null) return;
    const threshold = window.prompt(
      'Seuil de réussite',
      String(selected.passPercentage),
    );
    if (threshold === null) return;
    const limit = window.prompt(
      'Nombre maximal de tentatives',
      String(selected.maxAttempts),
    );
    if (limit === null) return;
    await action(async () => {
      await request(`/evaluations/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          passPercentage: Number(threshold),
          maxAttempts: Number(limit),
        }),
      });
      await load();
      await detail(selected.id);
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
  async function startAttempt() {
    if (selected === null) return;
    const enrollment = enrollments.find(
      ({ training }) => training.id === selected.training.id,
    );
    if (enrollment === undefined) {
      setError('Aucune inscription payée ne correspond à cette formation.');
      return;
    }
    await action(
      async () =>
        setAttempt(
          await request<Attempt>(`/evaluations/${selected.id}/attempts`, {
            method: 'POST',
            body: JSON.stringify({ enrollmentId: enrollment.id }),
          }),
        ),
      'Tentative démarrée.',
    );
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
  const trainings = owner
    ? managedTrainings
    : Array.from(
        new Map(
          page?.items.map(({ training }) => [training.id, training]),
        ).values(),
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
      </div>
      {notice !== '' && <p className="success-message">{notice}</p>}
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {owner && (
        <form
          className="content-card"
          onSubmit={(event) => void createEvaluation(event)}
        >
          <h2>Nouvelle évaluation</h2>
          <label>
            Formation
            <select name="trainingId" required>
              <option value="">Sélectionner</option>
              {trainings.map((training) => (
                <option key={training.id} value={training.id}>
                  {training.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Titre
            <input name="title" required />
          </label>
          <label>
            Instructions
            <textarea name="instructions" />
          </label>
          <div className="form-grid">
            <label>
              Seuil %
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
              Tentatives
              <input
                name="maxAttempts"
                type="number"
                min="1"
                defaultValue="3"
                required
              />
            </label>
            <label>
              Durée
              <input name="durationMinutes" type="number" min="1" />
            </label>
          </div>
          <button className="primary-button compact-button" disabled={busy}>
            Créer
          </button>
        </form>
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
                onClick={() => void detail(evaluation.id)}
              >
                <strong>{evaluation.title}</strong>
                <span>{evaluation.training.title}</span>
                <small>
                  {evaluation.status} · {evaluation.questionCount} question(s)
                </small>
              </button>
            ))}
          </aside>
          {selected !== null && (
            <div className="evaluation-detail">
              <article className="content-card">
                <span
                  className={`status-pill status-${selected.status.toLowerCase()}`}
                >
                  {selected.status}
                </span>
                <h2>{selected.title}</h2>
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
                        onClick={() => void editEvaluation()}
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
                        ? 'Retirer certification'
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
                              {result.learner.firstName ?? result.learner.email}
                            </strong>
                            <span>Tentative {result.attemptNumber}</span>
                          </div>
                          <span>
                            {result.scorePercentage}% · {result.status}
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
                      <select name="type">
                        <option value="SINGLE_CHOICE">Choix unique</option>
                        <option value="MULTIPLE_CHOICE">Choix multiple</option>
                        <option value="TRUE_FALSE">Vrai / faux</option>
                      </select>
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
                      {question.type} · {question.points} point(s)
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
                    {owner && selected.status === 'DRAFT' && (
                      <div className="management-actions">
                        <button
                          className="secondary-button compact-button"
                          disabled={busy}
                          onClick={() => void editQuestion(question)}
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
                selected.status === 'PUBLISHED' && (
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => void startAttempt()}
                  >
                    Commencer une tentative
                  </button>
                )}
              {user.role === 'LEARNER' && attempt !== null && (
                <div className="attempt-panel content-card">
                  <div className="managed-training-heading">
                    <h2>Tentative {attempt.attemptNumber}</h2>
                    <span
                      className={`status-pill status-${attempt.status.toLowerCase()}`}
                    >
                      {attempt.status}
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
                      Soumettre
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
          )}
        </div>
      )}
    </section>
  );
}
