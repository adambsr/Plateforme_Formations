import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { CalendarRange } from 'lucide-react';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type { PaginatedUsers } from '../../core/auth/types.js';
import { Pagination } from '../../shared/components/Pagination.js';
import { Select } from '../../shared/components/Select.js';
import type { PaginatedSessions } from '../sessions/types.js';
import type { Training } from '../trainings/types.js';
import type {
  LearningInsights,
  Overview,
  Page,
  Participation,
  Profitability,
  ProgressDashboard,
  Satisfaction,
  TrainerCost,
  TrainingCost,
} from './types.js';

const money = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value / 100);
const percent = (value: number | null) =>
  value === null ? 'Données insuffisantes' : `${value}%`;
const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
type DashboardData = {
  overview: Overview;
  participation: Participation;
  progress: ProgressDashboard;
  satisfaction: Satisfaction;
  profitability: Profitability;
  learningInsights: LearningInsights;
};

export function DashboardPage() {
  const { request } = useAuth();
  const initial = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    return {
      from: `${year}-01-01`,
      to: `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    };
  }, []);
  const [range, setRange] = useState(initial);
  const [data, setData] = useState<DashboardData>();
  const [options, setOptions] = useState<{
    trainers: PaginatedUsers['items'];
    trainings: Training[];
    sessions: PaginatedSessions['items'];
  }>({ trainers: [], trainings: [], sessions: [] });
  const [trainerCosts, setTrainerCosts] = useState<TrainerCost[]>([]);
  const [trainingCosts, setTrainingCosts] = useState<TrainingCost[]>([]);
  const [trainerCostPage, setTrainerCostPage] = useState<Page<TrainerCost>>();
  const [trainingCostPage, setTrainingCostPage] =
    useState<Page<TrainingCost>>();
  const [trainerCostPageNumber, setTrainerCostPageNumber] = useState(1);
  const [trainingCostPageNumber, setTrainingCostPageNumber] = useState(1);
  const [editing, setEditing] = useState<TrainingCost>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams(range).toString();
    try {
      const results = await Promise.all([
        request<Overview>(`/dashboard/overview?${query}`),
        request<Participation>(`/dashboard/participation?${query}`),
        request<ProgressDashboard>(`/dashboard/progress?${query}`),
        request<Satisfaction>(`/dashboard/satisfaction?${query}`),
        request<Profitability>(`/dashboard/profitability?${query}`),
        request<LearningInsights>(`/dashboard/learning-insights?${query}`),
        request<PaginatedUsers>('/trainers?pageSize=100'),
        request<Page<Training>>('/trainings?view=MANAGED&pageSize=100'),
        request<PaginatedSessions>('/sessions?view=MANAGED&pageSize=100'),
        request<Page<TrainerCost>>(
          `/costs/trainers?page=${trainerCostPageNumber}&pageSize=8`,
        ),
        request<Page<TrainingCost>>(
          `/costs/trainings?${query}&page=${trainingCostPageNumber}&pageSize=8`,
        ),
      ]);
      setData({
        overview: results[0],
        participation: results[1],
        progress: results[2],
        satisfaction: results[3],
        profitability: results[4],
        learningInsights: results[5],
      });
      setOptions({
        trainers: results[6].items,
        trainings: results[7].items,
        sessions: results[8].items,
      });
      setTrainerCosts(results[9].items);
      setTrainingCosts(results[10].items);
      setTrainerCostPage(results[9]);
      setTrainingCostPage(results[10]);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [range, request, trainerCostPageNumber, trainingCostPageNumber]);
  useEffect(() => {
    // Route entry and range changes synchronize backend-owned aggregates.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function saveMonthly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const [year, month] = String(form.get('period')).split('-');
    try {
      await request(
        `/costs/trainers/${form.get('trainerId')}/${year}/${month}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            amountMinor: Math.round(Number(form.get('amount')) * 100),
            ...(form.get('note') ? { note: form.get('note') } : {}),
          }),
        },
      );
      setNotice('Coût mensuel enregistré.');
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }
  async function saveExplicit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const sessionId = String(form.get('sessionId'));
    const body = {
      trainingId: form.get('trainingId'),
      sessionId: sessionId === '' ? null : sessionId,
      date: form.get('date'),
      amountMinor: Math.round(Number(form.get('amount')) * 100),
      label: form.get('label'),
    };
    try {
      await request(
        editing ? `/costs/trainings/${editing.id}` : '/costs/trainings',
        { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) },
      );
      setEditing(undefined);
      setNotice('Dépense enregistrée.');
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }
  async function remove(cost: TrainingCost) {
    if (!window.confirm(`Supprimer « ${cost.label} » ?`)) return;
    try {
      await request(`/costs/trainings/${cost.id}`, { method: 'DELETE' });
      setNotice('Dépense supprimée.');
      await load();
    } catch (caught) {
      setError(message(caught));
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Pilotage du centre</span>
          <h1>Tableau de bord</h1>
        </div>
      </div>
      <div className="dashboard-range" aria-label="Période d'analyse">
        <span className="filter-icon"><CalendarRange aria-hidden="true" size={19} /></span>
        <label className="date-field">
          Début
          <input
            aria-label="Du"
            type="date"
            value={range.from}
            onChange={(event) =>
              setRange({ ...range, from: event.target.value })
            }
            required
          />
        </label>
        <label className="date-field">
          Fin
          <input
            aria-label="Au"
            type="date"
            value={range.to}
            onChange={(event) => setRange({ ...range, to: event.target.value })}
            required
          />
        </label>
      </div>
      {notice && <p className="success-message">{notice}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Calcul des indicateurs…</p>
      ) : data ? (
        <DashboardResults data={data} trainings={options.trainings} />
      ) : null}
      <div className="dashboard-management">
        <form
          className="content-card"
          onSubmit={(event) => void saveMonthly(event)}
        >
          <h2>Coût mensuel formateur</h2>
          <label>
            Formateur
            <Select name="trainerId" required>
              <option value="">Choisir</option>
              {options.trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {[trainer.profile.firstName, trainer.profile.lastName]
                    .filter(Boolean)
                    .join(' ') || trainer.email}
                </option>
              ))}
            </Select>
          </label>
          <label className="date-field">
            Période
            <input
              name="period"
              type="month"
              defaultValue={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Année
              <input
                name="year"
                type="number"
                min="2000"
                max="2100"
                defaultValue={new Date().getFullYear()}
                required
              />
            </label>
            <label>
              Mois
              <input
                name="month"
                type="number"
                min="1"
                max="12"
                defaultValue={new Date().getMonth() + 1}
                required
              />
            </label>
          </div>
          <label>
            Montant EUR
            <input
              name="amount"
              type="number"
              min="0.001"
              step="0.001"
              required
            />
          </label>
          <label>
            Note
            <textarea name="note" maxLength={1000} />
          </label>
          <button className="primary-button" disabled={saving}>
            Enregistrer
          </button>
          {trainerCosts.length === 0 ? (
            <p className="muted">Aucun coût mensuel.</p>
          ) : (
            <div className="dashboard-table">
              {trainerCosts.map((cost) => (
                <div key={cost.id}>
                  <span>
                    {cost.trainer.email} · {cost.month}/{cost.year}
                  </span>
                  <strong>{money(cost.amountMinor)}</strong>
                </div>
              ))}
            </div>
          )}
          {trainerCostPage !== undefined && (
            <Pagination
              page={trainerCostPage.page}
              pageSize={trainerCostPage.pageSize}
              total={trainerCostPage.total}
              onPageChange={setTrainerCostPageNumber}
              label="Pagination des coûts formateurs"
            />
          )}
        </form>
        <form
          className="content-card"
          key={editing?.id ?? 'create'}
          onSubmit={(event) => void saveExplicit(event)}
        >
          <h2>
            {editing ? 'Modifier la dépense' : 'Nouvelle dépense formation'}
          </h2>
          <label>
            Formation
            <Select
              name="trainingId"
              defaultValue={editing?.training.id ?? ''}
              required
            >
              <option value="">Choisir</option>
              {options.trainings.map((training) => (
                <option key={training.id} value={training.id}>
                  {training.title}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Session facultative
            <Select name="sessionId" defaultValue={editing?.session?.id ?? ''}>
              <option value="">Aucune</option>
              {options.sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.training.title} · {session.title}
                </option>
              ))}
            </Select>
          </label>
          <div className="form-grid">
            <label>
              Date
              <input
                name="date"
                type="date"
                defaultValue={editing?.date ?? range.from}
                required
              />
            </label>
            <label>
              Montant EUR
              <input
                name="amount"
                type="number"
                min="0.001"
                step="0.001"
                defaultValue={editing ? editing.amountMinor / 100 : ''}
                required
              />
            </label>
          </div>
          <label>
            Libellé
            <input
              name="label"
              maxLength={200}
              defaultValue={editing?.label ?? ''}
              required
            />
          </label>
          <div className="form-actions">
            <button className="primary-button" disabled={saving}>
              {editing ? 'Mettre à jour' : 'Créer'}
            </button>
            {editing && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditing(undefined)}
              >
                Annuler
              </button>
            )}
          </div>
          {trainingCosts.length === 0 ? (
            <p className="muted">Aucune dépense sur cette période.</p>
          ) : (
            <div className="dashboard-table">
              {trainingCosts.map((cost) => (
                <div key={cost.id}>
                  <span>
                    <strong>{cost.training.title}</strong>
                    <small>
                      {cost.date} · {cost.label}
                    </small>
                  </span>
                  <strong>{money(cost.amountMinor)}</strong>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => setEditing(cost)}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void remove(cost)}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
          {trainingCostPage !== undefined && (
            <Pagination
              page={trainingCostPage.page}
              pageSize={trainingCostPage.pageSize}
              total={trainingCostPage.total}
              onPageChange={setTrainingCostPageNumber}
              label="Pagination des dépenses de formation"
            />
          )}
        </form>
      </div>
    </section>
  );
}

function DashboardResults({
  data,
  trainings,
}: {
  data: DashboardData;
  trainings: Training[];
}) {
  const overviewMetrics = {
    trainings: { label: 'Formations', icon: '▤' },
    sessions: { label: 'Sessions', icon: '◷' },
    learners: { label: 'Apprenants', icon: '◎' },
    trainers: { label: 'Formateurs', icon: '◇' },
    enrollments: { label: 'Inscriptions', icon: '✓' },
  } as const;
  return (
    <>
      <div className="metric-grid">
        {Object.entries(data.overview.counts).map(([label, value]) => (
          <article className={`metric-card metric-${label}`} key={label}>
            <span className="metric-icon" aria-hidden="true">
              {overviewMetrics[label as keyof typeof overviewMetrics].icon}
            </span>
            <span>
              {overviewMetrics[label as keyof typeof overviewMetrics].label}
            </span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="dashboard-panels">
        <article className="content-card">
          <h2>Participation</h2>
          <strong>
            {percent(data.participation.overall.participationPercent)}
          </strong>
          {data.participation.overall.expected === 0 ? (
            <p>Aucune présence n’était attendue sur cette période.</p>
          ) : (
            <p>
              {data.participation.overall.present} présente(s) sur{' '}
              {data.participation.overall.expected} présence(s) attendue(s) ·{' '}
              {data.participation.overall.recorded} saisie(s)
            </p>
          )}
        </article>
        <article className="content-card">
          <h2>Apprentissage</h2>
          <p>
            Progression :{' '}
            <strong>
              {percent(data.progress.selfPaced.averagePercentage)}
            </strong>
          </p>
          <small>
            {data.progress.selfPaced.enrollmentCount} inscription(s) en ligne
            prise(s) en compte
          </small>
          <p>
            Réussite :{' '}
            <strong>{percent(data.progress.evaluations.passPercent)}</strong>
          </p>
          <small>
            {data.progress.evaluations.totalAttempts} tentative(s) terminée(s)
          </small>
        </article>
        <article className="content-card">
          <h2>Satisfaction</h2>
          <strong>
            {data.satisfaction.global.average === null
              ? 'Aucun avis'
              : `${data.satisfaction.global.average}/5`}
          </strong>
          <p>{data.satisfaction.global.count} avis</p>
        </article>
      </div>
      <div className="metric-grid">
        <article className="metric-card">
          <span>Revenus payés</span>
          <strong>{money(data.profitability.revenueMinor)}</strong>
        </article>
        <article className="metric-card">
          <span>Coûts formateurs</span>
          <strong>{money(data.profitability.trainerCostsMinor)}</strong>
        </article>
        <article className="metric-card">
          <span>Dépenses formations</span>
          <strong>{money(data.profitability.trainingCostsMinor)}</strong>
        </article>
        <article className="metric-card">
          <span>Résultat global</span>
          <strong>{money(data.profitability.resultMinor)}</strong>
          <small>{percent(data.profitability.profitabilityPercent)}</small>
        </article>
      </div>
      <LearningInsightCards data={data.learningInsights} />
      <DashboardCharts data={data} />
      <TrainingResults rows={data.profitability.byTraining} trainings={trainings} />
    </>
  );
}

function LearningInsightCards({ data }: { data: LearningInsights }) {
  const maximum = Math.max(
    1,
    ...data.completionTrend.map((point) => point.completed),
  );
  return (
    <div className='learning-insight-grid'>
      <figure className='content-card'>
        <figcaption>Complétions self-paced par mois</figcaption>
        {data.completionTrend.length === 0 ? (
          <p className='muted'>Aucune compl\u00e9tion sur cette p\u00e9riode.</p>
        ) : (
          data.completionTrend.map((point) => (
            <Bar
              key={point.month}
              label={point.month}
              value={point.completed}
              max={maximum}
              shown={String(point.completed)}
            />
          ))
        )}
      </figure>
      <article className='content-card inactive-learners-card'>
        <h2>Apprenants devenus inactifs</h2>
        <p>
          <strong>{data.inactivity.total}</strong> apprenant(s) sans activit\u00e9
          depuis au moins {data.inactivity.thresholdDays} jours.
        </p>
        {data.inactivity.learners.length === 0 ? (
          <p className='muted'>Aucun apprenant \u00e0 relancer.</p>
        ) : (
          <ul>
            {data.inactivity.learners.map((row) => (
              <li key={row.learner.id}>
                <span>
                  <strong>
                    {[row.learner.firstName, row.learner.lastName]
                      .filter(Boolean)
                      .join(' ') || row.learner.email}
                  </strong>
                  <small>{row.trainingTitles.join(', ')}</small>
                </span>
                <span className='status-pill'>{row.inactiveDays} jours</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

function DashboardCharts({ data }: { data: DashboardData }) {
  const satisfaction = Object.entries(data.satisfaction.global.distribution);
  const popular = [...data.profitability.byTraining]
    .sort((left, right) => right.revenueMinor - left.revenueMinor)
    .slice(0, 5);
  const maxRevenue = Math.max(1, ...popular.map((row) => row.revenueMinor));
  const financialMax = Math.max(
    1,
    data.profitability.revenueMinor,
    data.profitability.totalCostsMinor,
  );
  return (
    <div className="chart-grid">
      <SatisfactionDonut data={data.satisfaction.global} />
      <figure className="content-card">
        <figcaption>Revenus et coûts</figcaption>
        <Bar
          label="Revenus payés"
          value={data.profitability.revenueMinor}
          max={financialMax}
          shown={money(data.profitability.revenueMinor)}
        />
        <Bar
          label="Coûts totaux"
          value={data.profitability.totalCostsMinor}
          max={financialMax}
          shown={money(data.profitability.totalCostsMinor)}
          tone="cost"
        />
        <Bar
          label="Résultat"
          value={Math.max(0, data.profitability.resultMinor)}
          max={financialMax}
          shown={money(data.profitability.resultMinor)}
          tone="result"
        />
      </figure>
      <figure className="content-card">
        <figcaption>Satisfaction (1 à 5)</figcaption>
        {satisfaction.map(([rating, count]) => (
          <Bar
            key={rating}
            label={`${rating} étoile${rating === '1' ? '' : 's'}`}
            value={count}
            max={Math.max(1, data.satisfaction.global.count)}
            shown={String(count)}
          />
        ))}
      </figure>
      <figure className="content-card">
        <figcaption>Participation par formation</figcaption>
        {data.participation.byTraining.length === 0 ? (
          <p className="muted">Aucune présence attendue sur la période.</p>
        ) : (
          data.participation.byTraining
            .slice(0, 5)
            .map((row) => (
              <Bar
                key={row.training.id}
                label={row.training.title}
                value={row.participationPercent ?? 0}
                max={100}
                shown={percent(row.participationPercent)}
              />
            ))
        )}
      </figure>
      <figure className="content-card">
        <figcaption>Formations par revenus confirmés</figcaption>
        {popular.length === 0 ? (
          <p className="muted">Aucun revenu confirmé sur la période.</p>
        ) : (
          popular.map((row) => (
            <Bar
              key={row.training.id}
              label={row.training.title}
              value={row.revenueMinor}
              max={maxRevenue}
              shown={money(row.revenueMinor)}
            />
          ))
        )}
      </figure>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  shown,
  tone = 'primary',
}: {
  label: string;
  value: number;
  max: number;
  shown: string;
  tone?: 'primary' | 'cost' | 'result';
}) {
  const width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  return (
    <div className="chart-row">
      <div>
        <span>{label}</span>
        <strong>{shown}</strong>
      </div>
      <div
        className="chart-track"
        role="img"
        aria-label={`${label} : ${shown}`}
      >
        <span className={`chart-bar chart-${tone}`} style={{ width }} />
      </div>
    </div>
  );
}

function SatisfactionDonut({ data }: { data: Satisfaction['global'] }) {
  const total = Math.max(1, data.count);
  const positive = (data.distribution['4'] + data.distribution['5']) / total;
  return (
    <figure className="content-card satisfaction-donut">
      <figcaption>Satisfaction positive</figcaption>
      <div
        className="donut"
        style={{ '--positive': `${positive * 360}deg` } as React.CSSProperties}
        role="img"
        aria-label={`${Math.round(positive * 100)}% de notes quatre ou cinq étoiles`}
      >
        <strong>{data.count === 0 ? '—' : `${Math.round(positive * 100)}%`}</strong>
        <span>4–5 étoiles</span>
      </div>
      <p className="muted">{data.count} avis sur la période</p>
    </figure>
  );
}

function TrainingResults({
  rows,
  trainings,
}: {
  rows: Profitability['byTraining'];
  trainings: Training[];
}) {
  const [categoryId, setCategoryId] = useState('');
  const [modality, setModality] = useState('');
  const [visible, setVisible] = useState<Profitability['byTraining']>([]);
  const details = new Map(trainings.map((training) => [training.id, training]));
  const categories = Array.from(new Map(trainings.map((training) => [training.category.id, training.category])).values());
  function applyFilters() {
    setVisible(rows.filter((row) => {
      const training = details.get(row.training.id);
      return (categoryId === '' || training?.category.id === categoryId) &&
        (modality === '' || training?.type === modality);
    }));
  }
  if (rows.length === 0)
    return (
      <div className="empty-state">
        <h2>Aucun mouvement par formation</h2>
      </div>
    );
  return (
    <div className="content-card dashboard-table training-results-card">
      <div className="result-filters">
        <label>Catégorie
          <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Toutes</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
        </label>
        <label>Modalité
          <Select value={modality} onChange={(event) => setModality(event.target.value)}>
            <option value="">Toutes</option>
            <option value="SELF_PACED_ONLINE">En ligne</option>
            <option value="IN_PERSON">Présentiel</option>
          </Select>
        </label>
        <button className="secondary-button compact-button" type="button" onClick={applyFilters}>Appliquer</button>
      </div>
      <h2>Résultat avant coûts fixes des formateurs</h2>
      {visible.map((row) => (
        <div key={row.training.id}>
          <span>{row.training.title}</span>
          <strong>{money(row.resultBeforeFixedTrainerCostsMinor)}</strong>
        </div>
      ))}
    </div>
  );
}
