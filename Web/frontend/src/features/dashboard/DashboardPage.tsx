import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Users,
  GraduationCap,
  CreditCard,
  ChartNoAxesCombined,
  ClipboardCheck,
  Wallet,
  BookOpen,
  Award,
  Pencil,
  Plus,
  Trash2,
  Tags,
} from 'lucide-react';
import {
  DashboardHero,
  DashboardStatCard,
  DashboardSectionHeader,
  DashboardLoadingState,
  DashboardErrorState,
  QuickActionCard,
  DashboardModal,
} from './DashboardComponents.js';

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

const rangeEnd = new Date();
rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 1, 0);

const OVERALL_RANGE = {
  from: '1970-01-01',
  to: rangeEnd.toISOString().slice(0, 10),
} as const;

export function DashboardPage() {
  const { request, user } = useAuth();
  const range = OVERALL_RANGE;
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
  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
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
        loadAllManagedTrainings(request),
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
      setMonthlyModalOpen(false);
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
      setExpenseModalOpen(false);
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
    <section className="hsa-dashboard hsa-admin-dashboard">
      <DashboardHero
        role="ADMIN"
        name={user?.profile.firstName || 'Admin'}
        description="Gérez la plateforme, suivez les indicateurs et accompagnez la réussite de votre centre de formation."
      />
      <h2 className="sr-only">Tableau de bord</h2>
      <nav className="hsa-section-nav" aria-label="Sections du tableau de bord">
        <a href="#platform-overview">Vue d’ensemble</a>
        <a href="#learning-insights">Suivi pédagogique</a>
        <a href="#dashboard-finances">Finances</a>
        <a href="#dashboard-costs">Gestion des coûts</a>
      </nav>
      {notice && <p className="success-message">{notice}</p>}
      {error && <DashboardErrorState error={error} retry={load} />}
      {loading ? (
        <DashboardLoadingState />
      ) : data ? (
        <DashboardResults data={data} trainings={options.trainings} />
      ) : null}
      <DashboardSectionHeader
        id="dashboard-costs"
        title="Gestion des coûts"
        description="Enregistrez les coûts mensuels des formateurs et les dépenses des formations."
        icon={Wallet}
      />
      <div className="dashboard-management">
        <article className="content-card hsa-cost-card">
          <div className="hsa-cost-heading">
            <div>
              <span className="hsa-icon hsa-tone-blue">
                <Users aria-hidden="true" />
              </span>
              <div>
                <h2>Coût mensuel formateur</h2>
                <p>Rémunérations mensuelles enregistrées</p>
              </div>
            </div>
            <button
              className="primary-button compact-button"
              type="button"
              onClick={() => setMonthlyModalOpen(true)}
            >
              <Plus aria-hidden="true" size={16} /> Ajouter un coût
            </button>
          </div>
          {trainerCosts.length === 0 ? (
            <p className="muted">Aucun coût mensuel.</p>
          ) : (
            <CostTable
              label="Coûts mensuels des formateurs"
              headers={['Formateur', 'Période', 'Note', 'Montant']}
            >
              {trainerCosts.map((cost) => (
                <tr key={cost.id}>
                  <th scope="row">
                    {[cost.trainer.firstName, cost.trainer.lastName]
                      .filter(Boolean)
                      .join(' ') || 'Formateur'}
                    <small>{cost.trainer.email}</small>
                  </th>
                  <td>
                    {String(cost.month).padStart(2, '0')}/{cost.year}
                  </td>
                  <td>{cost.note || '-'}</td>
                  <td className="hsa-amount">{money(cost.amountMinor)}</td>
                </tr>
              ))}
            </CostTable>
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
        </article>
        <article className="content-card hsa-cost-card">
          <div className="hsa-cost-heading">
            <div>
              <span className="hsa-icon hsa-tone-orange">
                <Wallet aria-hidden="true" />
              </span>
              <div>
                <h2>Dépenses formations</h2>
                <p>Dépenses variables par formation</p>
              </div>
            </div>
            <button
              className="primary-button compact-button"
              type="button"
              onClick={() => {
                setEditing(undefined);
                setExpenseModalOpen(true);
              }}
            >
              <Plus aria-hidden="true" size={16} /> Ajouter une dépense
            </button>
          </div>
          {trainingCosts.length === 0 ? (
            <p className="muted">Aucune dépense enregistrée.</p>
          ) : (
            <CostTable
              label="Dépenses des formations"
              headers={['Formation', 'Date et libellé', 'Montant', 'Actions']}
            >
              {trainingCosts.map((cost) => (
                <tr key={cost.id}>
                  <th scope="row">
                    {cost.training.title}
                    <small>{cost.session?.title}</small>
                  </th>
                  <td>
                    {cost.date}
                    <small>{cost.label}</small>
                  </td>
                  <td className="hsa-amount">{money(cost.amountMinor)}</td>
                  <td>
                    <div className="hsa-table-actions">
                      <button
                        type="button"
                        className="hsa-table-action"
                        title="Modifier"
                        aria-label={`Modifier la dépense ${cost.label}`}
                        onClick={() => {
                          setEditing(cost);
                          setExpenseModalOpen(true);
                        }}
                      >
                        <Pencil aria-hidden="true" size={16} />
                      </button>
                      <button
                        type="button"
                        className="hsa-table-action hsa-table-action-danger"
                        title="Supprimer"
                        aria-label={`Supprimer la dépense ${cost.label}`}
                        onClick={() => void remove(cost)}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </CostTable>
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
        </article>
      </div>
      {monthlyModalOpen && (
        <DashboardModal
          title="Ajouter un coût formateur"
          close={() => setMonthlyModalOpen(false)}
        >
          <form
            className="hsa-modal-form"
            onSubmit={(event) => void saveMonthly(event)}
          >
            <input
              type="hidden"
              name="year"
              value={new Date().getFullYear()}
              readOnly
            />
            <input
              type="hidden"
              name="month"
              value={new Date().getMonth() + 1}
              readOnly
            />
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
            <label>
              Période
              <input
                name="period"
                type="month"
                defaultValue={new Date().toISOString().slice(0, 7)}
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
                required
              />
            </label>
            <label>
              Note
              <textarea name="note" maxLength={1000} />
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setMonthlyModalOpen(false)}
              >
                Annuler
              </button>
            </div>
          </form>
        </DashboardModal>
      )}
      {expenseModalOpen && (
        <DashboardModal
          title={editing ? 'Modifier la dépense' : 'Ajouter une dépense'}
          close={() => {
            setEditing(undefined);
            setExpenseModalOpen(false);
          }}
        >
          <form
            className="hsa-modal-form"
            key={editing?.id ?? 'create'}
            onSubmit={(event) => void saveExplicit(event)}
          >
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
              <Select
                name="sessionId"
                defaultValue={editing?.session?.id ?? ''}
              >
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
                  defaultValue={editing?.date ?? range.to}
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
                {saving
                  ? 'Enregistrement…'
                  : editing
                    ? 'Mettre à jour'
                    : 'Enregistrer'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditing(undefined);
                  setExpenseModalOpen(false);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        </DashboardModal>
      )}
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
  return (
    <>
      <DashboardSectionHeader
        id="platform-overview"
        title="Vue d’ensemble de la plateforme"
        description="Indicateurs cumulés depuis la création de la plateforme."
        icon={ChartNoAxesCombined}
      />
      <div className="hsa-stats">
        <DashboardStatCard
          label="Apprenants"
          value={data.overview.counts.learners}
          icon={Users}
          to="/app/users"
          action="Voir les utilisateurs"
        />
        <DashboardStatCard
          label="Formations"
          value={data.overview.counts.trainings}
          icon={GraduationCap}
          tone="green"
          to="/app/trainings"
          action="Gérer les formations"
        />
        <DashboardStatCard
          label="Sessions"
          value={data.overview.counts.sessions}
          icon={CalendarDays}
          tone="purple"
          to="/app/sessions"
          action="Voir les sessions"
        />
        <DashboardStatCard
          label="Revenus payés"
          value={money(data.profitability.revenueMinor)}
          icon={CreditCard}
          tone="orange"
          to="/app/payments"
          action="Voir les paiements"
        />
      </div>
      <div className="hsa-overview-strip">
        <span>
          <Users size={18} aria-hidden="true" />
          <strong>{data.overview.counts.trainers}</strong> formateurs
        </span>
        <span>
          <ClipboardCheck size={18} aria-hidden="true" />
          <strong>{data.overview.counts.enrollments}</strong> inscriptions
        </span>
        <span>
          <Award size={18} aria-hidden="true" />
          <strong>{data.progress.selfPaced.completedEnrollments}</strong>{' '}
          parcours en ligne terminés
        </span>
      </div>
      <CompletionTrendCard data={data.learningInsights} />
      <div className="hsa-quick-grid">
        <QuickActionCard
          to="/app/users"
          title="Utilisateurs"
          text="Gérer les comptes"
          icon={Users}
        />
        <QuickActionCard
          to="/app/trainings"
          title="Formations"
          text="Organiser le catalogue"
          icon={BookOpen}
        />
        <QuickActionCard
          to="/app/evaluations"
          title="Évaluations"
          text="Suivre les résultats"
          icon={ClipboardCheck}
        />
        <QuickActionCard
          to="/app/certificates"
          title="Certificats"
          text="Certifications et avis"
          icon={Award}
        />
      </div>
      <DashboardSectionHeader
        id="learning-insights"
        title="Suivi pédagogique"
        description="Participation, apprentissage et satisfaction cumulés."
        icon={GraduationCap}
      />
      <div className="dashboard-panels">
        <article className="content-card">
          <h2>Participation</h2>
          <strong>
            {percent(data.participation.overall.participationPercent)}
          </strong>
          {data.participation.overall.expected === 0 ? (
            <p>Aucune présence n’est enregistrée.</p>
          ) : (
            <p>
              {data.participation.overall.present} présence(s) sur{' '}
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
      <DashboardSectionHeader
        id="dashboard-finances"
        title="Finances et rentabilité"
        description="Revenus confirmés, dépenses et résultats cumulés."
        icon={Wallet}
      />
      <div className="metric-grid hsa-finance-grid">
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
      <DashboardCharts data={data} trainings={trainings} />
      <TrainingResults
        rows={data.profitability.byTraining}
        trainings={trainings}
      />
    </>
  );
}

function CostTable({
  label,
  headers,
  children,
}: {
  label: string;
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div
      className="hsa-table-scroll"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="hsa-cost-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th scope="col" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function CompletionTrendCard({ data }: { data: LearningInsights }) {
  const maximum = Math.max(
    1,
    ...data.completionTrend.map((point) => point.completed),
  );
  return (
    <figure className="content-card hsa-wide-chart">
      <DashboardSectionHeader
        title="Complétions des formations en ligne"
        description="Évolution mensuelle sur toute la durée de la plateforme."
        icon={ChartNoAxesCombined}
      />
      {data.completionTrend.length === 0 ? (
        <p className="muted">Aucune complétion enregistrée.</p>
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
  );
}

function DashboardCharts({
  data,
  trainings,
}: {
  data: DashboardData;
  trainings: Training[];
}) {
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
      <TrainingDistribution trainings={trainings} />
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
          <p className="muted">Aucune présence enregistrée.</p>
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
          <p className="muted">Aucun revenu confirmé.</p>
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
        <strong>
          {data.count === 0 ? '-' : `${Math.round(positive * 100)}%`}
        </strong>
        <span>4-5 étoiles</span>
      </div>
      <p className="muted">{data.count} avis au total</p>
    </figure>
  );
}

function TrainingDistribution({ trainings }: { trainings: Training[] }) {
  const counts = Array.from(
    trainings.reduce((rows, training) => {
      rows.set(
        training.category.name,
        (rows.get(training.category.name) ?? 0) + 1,
      );
      return rows;
    }, new Map<string, number>()),
  ).sort((left, right) => right[1] - left[1]);
  const colors = ['#1479e8', '#22ae91', '#8256df', '#f39a30', '#ef6172'];
  const total = trainings.length;
  let cursor = 0;
  const segments = counts.map(([, count], index) => {
    const start = cursor;
    cursor += total === 0 ? 0 : (count / total) * 360;
    return `${colors[index % colors.length]} ${start}deg ${cursor}deg`;
  });
  return (
    <figure className="content-card satisfaction-donut">
      <DashboardSectionHeader title="Répartition des formations" icon={Tags} />
      <div
        className="donut"
        style={{
          background:
            total === 0 ? '#e8edf4' : `conic-gradient(${segments.join(',')})`,
        }}
        role="img"
        aria-label={`${total} formations réparties dans ${counts.length} catégories`}
      >
        <strong>{total}</strong>
        <span>formations</span>
      </div>
      {counts.length === 0 ? (
        <p className="muted">Aucune formation.</p>
      ) : (
        <ul className="hsa-chart-legend">
          {counts.slice(0, 5).map(([label, count], index) => (
            <li key={label}>
              <i style={{ background: colors[index % colors.length] }} />{' '}
              <span>{label}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>
      )}
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
  const [applied, setApplied] = useState({ categoryId: '', modality: '' });
  const [pageNumber, setPageNumber] = useState(1);
  const pageSize = 8;
  const details = new Map(trainings.map((training) => [training.id, training]));
  const categories = Array.from(
    new Map(
      trainings.map((training) => [training.category.id, training.category]),
    ).values(),
  );
  function applyFilters() {
    setApplied({ categoryId, modality });
    setPageNumber(1);
  }
  const visible = rows.filter((row) => {
    const training = details.get(row.training.id);
    return (
      (applied.categoryId === '' ||
        training?.category.id === applied.categoryId) &&
      (applied.modality === '' || training?.type === applied.modality)
    );
  });
  const visiblePage = visible.slice(
    (pageNumber - 1) * pageSize,
    pageNumber * pageSize,
  );
  if (rows.length === 0)
    return (
      <div className="empty-state">
        <h2>Aucun mouvement par formation</h2>
      </div>
    );
  return (
    <div className="content-card dashboard-table training-results-card">
      <div className="result-filters">
        <label>
          Catégorie
          <Select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Toutes</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Modalité
          <Select
            value={modality}
            onChange={(event) => setModality(event.target.value)}
          >
            <option value="">Toutes</option>
            <option value="SELF_PACED_ONLINE">En ligne</option>
            <option value="IN_PERSON">Présentiel</option>
          </Select>
        </label>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={applyFilters}
        >
          Appliquer
        </button>
      </div>
      <h2>Résultat avant coûts fixes des formateurs</h2>
      {visible.length === 0 ? (
        <p className="muted">Aucune formation ne correspond aux filtres.</p>
      ) : (
        <div
          className="hsa-table-scroll"
          role="region"
          aria-label="Résultats financiers par formation"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Formation</th>
                <th scope="col">Revenus</th>
                <th scope="col">Dépenses</th>
                <th scope="col">Résultat</th>
              </tr>
            </thead>
            <tbody>
              {visiblePage.map((row) => (
                <tr key={row.training.id}>
                  <th scope="row">{row.training.title}</th>
                  <td>{money(row.revenueMinor)}</td>
                  <td>{money(row.trainingCostsMinor)}</td>
                  <td>
                    <strong>
                      {money(row.resultBeforeFixedTrainerCostsMinor)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {visible.length > pageSize && (
        <Pagination
          page={pageNumber}
          pageSize={pageSize}
          total={visible.length}
          onPageChange={setPageNumber}
          label="Pagination des résultats financiers"
        />
      )}
    </div>
  );
}

async function loadAllManagedTrainings(
  request: ReturnType<typeof useAuth>['request'],
): Promise<Page<Training>> {
  const first = await request<Page<Training>>(
    '/trainings?view=MANAGED&page=1&pageSize=100',
  );
  const items = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++) {
    const next = await request<Page<Training>>(
      `/trainings?view=MANAGED&page=${page}&pageSize=100`,
    );
    items.push(...next.items);
  }
  return { ...first, items };
}
