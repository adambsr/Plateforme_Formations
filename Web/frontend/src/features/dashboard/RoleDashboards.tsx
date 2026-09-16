import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import {
  Award,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Sparkles,
  Activity,
  FileCheck2,
  UsersRound,
  UserPlus,
  Zap,
} from 'lucide-react';
import {
  DashboardHero,
  DashboardStatCard,
  DashboardSectionHeader,
  QuickActionCard,
  DashboardLoadingState,
  DashboardErrorState,
  ProgressCard,
} from './DashboardComponents.js';

import { ApiError } from '../../core/api/client.js';
import {
  trackRecommendationClick,
  trackRecommendationImpressions,
} from '../../core/analytics/recommendation-analytics.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { roleHomePath } from '../../app/routes/destinations.js';
import { TrainingCard } from '../trainings/TrainingPages.js';

interface Page<T> {
  items: T[];
  total: number;
}
interface Named {
  id: string;
  title?: string;
  training?: { title: string };
  status?: string;
  startAt?: string;
  location?: string;
  room?: string;
  enrolledCount?: number;
}
interface Progress {
  training: { title: string };
  percentage: number;
  isComplete: boolean;
}
interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: 'SELF_PACED_ONLINE' | 'IN_PERSON';
  level: string;
  durationMinutes: number;
  priceMinor: number;
  currency: 'EUR';
  categoryId: string;
  categoryName: string;
  thumbnailUrl?: string;
  reason: string;
}
interface Recommendations {
  strategy: 'HISTORY_AND_POPULARITY';
  recommendations: Recommendation[];
}
interface TrainerWorkspace {
  learnerCount: number;
  activity: Array<{
    id: string;
    type: 'ENROLLMENT' | 'EVALUATION' | 'SESSION';
    title: string;
    description: string;
    occurredAt: string;
  }>;
}

const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Impossible de charger votre tableau de bord.';

export function RoleIndexRedirect() {
  const { user } = useAuth();
  return user === null ? null : (
    <Navigate to={roleHomePath(user.role)} replace />
  );
}

export function TrainerDashboard() {
  const { user, request } = useAuth();
  const [data, setData] = useState<{
    trainings: Page<Named>;
    sessions: Page<Named>;
    evaluations: Page<Named>;
    workspace: TrainerWorkspace;
  }>();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [trainings, sessions, evaluations, workspace] = await Promise.all([
        request<Page<Named>>('/trainings?view=MANAGED&page=1&pageSize=5'),
        request<Page<Named>>(
          '/sessions?view=MANAGED&status=PLANNED&page=1&pageSize=5',
        ),
        request<Page<Named>>('/evaluations?view=MANAGED&page=1&pageSize=5'),
        request<TrainerWorkspace>('/dashboard/trainer'),
      ]);
      setData({ trainings, sessions, evaluations, workspace });
    } catch (caught) {
      setError(message(caught));
    }
  }, [request]);
  useEffect(() => {
    /* oxlint-disable-next-line react/set-state-in-effect */ void load();
  }, [load]);
  if (user?.role !== 'TRAINER') return null;
  return (
    <RoleDashboard
      title={
        [user.profile.firstName, user.profile.lastName]
          .filter(Boolean)
          .join(' ') || user.email
      }
      role="TRAINER"
      subtitle="Retrouvez vos formations, vos prochaines sessions et les actions pédagogiques prioritaires."
      error={error}
      retry={load}
      loading={data === undefined && error === ''}
    >
      <div className="hsa-stats">
        <DashboardStatCard
          label="Formations gérées"
          value={data?.trainings.total}
          icon={GraduationCap}
          to="/app/trainings"
          action="Voir mes formations"
        />
        <DashboardStatCard
          label="Mes apprenants"
          value={data?.workspace.learnerCount}
          icon={UsersRound}
          tone="green"
          to="/app/attendance"
          action="Voir mes apprenants"
        />
        <DashboardStatCard
          label="Sessions planifiées"
          value={data?.sessions.total}
          icon={CalendarDays}
          tone="purple"
          to="/app/sessions"
          action="Voir mes sessions"
        />
        <DashboardStatCard
          label="Évaluations"
          value={data?.evaluations.total}
          icon={ClipboardCheck}
          tone="orange"
          to="/app/evaluations"
          action="Voir les évaluations"
        />
      </div>
      <div className="hsa-two-columns">
        <TrainerSessionsPanel rows={data?.sessions.items ?? []} />
        <TrainerActivityList rows={data?.workspace.activity ?? []} />
      </div>
      <DashboardSectionHeader
        title="Actions rapides"
        description="Vos outils pour accompagner les apprenants."
        icon={Zap}
      />
      <div className="hsa-quick-grid">
        <Action
          to="/app/trainings"
          title="Gérer mes formations"
          text="Contenu, modules, leçons et ressources."
        />
        <Action
          to="/app/sessions"
          title="Voir mes Sessions"
          text="Planning, salles et participants."
        />
        <Action
          to="/app/attendance"
          title="Saisir les présences"
          text="Accéder rapidement aux feuilles autorisées."
        />
        <Action
          to="/app/evaluations"
          title="Préparer une évaluation"
          text="Questions manuelles ou génération IA en brouillon."
        />
      </div>
      <Recent
        title="Mes formations"
        rows={data?.trainings.items ?? []}
        empty="Aucune formation ne vous est encore affectée."
        to="/app/trainings"
      />
    </RoleDashboard>
  );
}

export function LearnerDashboard() {
  const { user, request } = useAuth();
  const [data, setData] = useState<{
    progress: Page<Progress>;
    sessions: Page<Named>;
    payments: Page<Named>;
    certificates: Page<Named>;
    recommendations: Recommendations;
  }>();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [progress, sessions, payments, certificates, recommendations] =
        await Promise.all([
          loadProgress(request),
          request<Page<Named>>(
            '/sessions?view=ENROLLED&status=PLANNED&page=1&pageSize=5',
          ),
          request<Page<Named>>('/payments?page=1&pageSize=5'),
          request<Page<Named>>('/certificates?page=1&pageSize=5'),
          request<Recommendations>('/dashboard/recommendations'),
        ]);
      setData({ progress, sessions, payments, certificates, recommendations });
    } catch (caught) {
      setError(message(caught));
    }
  }, [request]);
  useEffect(() => {
    /* oxlint-disable-next-line react/set-state-in-effect */ void load();
  }, [load]);
  if (user?.role !== 'LEARNER') return null;
  const average = data?.progress.items.length
    ? Math.round(
        data.progress.items.reduce((sum, row) => sum + row.percentage, 0) /
          data.progress.items.length,
      )
    : undefined;
  return (
    <RoleDashboard
      title={
        [user.profile.firstName, user.profile.lastName]
          .filter(Boolean)
          .join(' ') || user.email
      }
      role="LEARNER"
      subtitle="Continuez vos parcours et retrouvez en un coup d’œil les prochaines étapes."
      error={error}
      retry={load}
      loading={data === undefined && error === ''}
    >
      <div className="hsa-stats">
        <DashboardStatCard
          label="Formations actives"
          value={data?.progress.total}
          icon={BookOpen}
          to="/app/progress"
          action="Voir mes formations"
        />
        <DashboardStatCard
          label="Progression moyenne"
          value={average === undefined ? '-' : `${average}%`}
          icon={ChartNoAxesCombined}
          tone="green"
          to="/app/progress"
          action="Voir mon suivi"
        />
        <DashboardStatCard
          label="Sessions planifiées"
          value={data?.sessions.total}
          icon={CalendarDays}
          tone="purple"
          to="/app/attendance"
          action="Voir mon planning"
        />
        <DashboardStatCard
          label="Certificats"
          value={data?.certificates.total}
          icon={Award}
          tone="orange"
          to="/app/certificates"
          action="Voir mes certificats"
        />
      </div>
      <ProgressCard
        average={average}
        total={data?.progress.total ?? 0}
        completed={
          data?.progress.items.filter((row) => row.isComplete).length ?? 0
        }
      />
      <RecommendationPanel data={data} />
      <Recent
        title="Mes sessions planifiées"
        rows={data?.sessions.items ?? []}
        empty="Aucune session planifiée pour le moment."
        to="/app/attendance"
      />
      <DashboardSectionHeader title="La prochaine étape" icon={Zap} />
      <div className="hsa-quick-grid">
        <Action
          to="/app/progress"
          title="Continuer à apprendre"
          text="Reprendre vos modules et leçons."
        />
        <Action
          to="/app/attendance"
          title="Consulter mon planning"
          text="Dates, horaires et lieux de vos sessions."
        />
        <Action
          to="/app/evaluations"
          title="Mes évaluations"
          text="Voir les évaluations disponibles et vos résultats."
        />
        <Action
          to="/app/payments"
          title="Paiements et factures"
          text="Retrouver mes paiements et mes factures."
        />
      </div>
      <Recent
        title="Progression en ligne"
        to="/app/progress"
        rows={(data?.progress.items ?? []).slice(0, 5).map((row, index) => ({
          id: String(index),
          title: row.training.title,
          status: row.isComplete ? 'Terminée' : `${row.percentage}%`,
        }))}
        empty="Aucune formation en ligne active."
      />
    </RoleDashboard>
  );
}

function RecommendationPanel({
  data,
}: {
  data: { recommendations: Recommendations } | undefined;
}) {
  const recommendations =
    data === undefined ? [] : data.recommendations.recommendations;
  useEffect(() => {
    if (data === undefined) return;
    trackRecommendationImpressions(
      data.recommendations.recommendations.map((recommendation, index) => ({
        trainingId: recommendation.id,
        categoryName: recommendation.categoryName,
        rank: index + 1,
      })),
    );
  }, [data]);
  return (
    <section
      className="recommendation-section"
      aria-labelledby="recommendations-title"
    >
      <DashboardSectionHeader
        title="Prochaines formations recommandées"
        id="recommendations-title"
        description="Des formations sélectionnées selon vos intérêts et votre progression."
        icon={Sparkles}
        to="/app/catalogue"
        action="Voir tout le catalogue"
      />
      {recommendations.length === 0 ? (
        <div className="content-card">
          <p className="muted">
            Aucune nouvelle recommandation pour le moment. Explorez le catalogue
            pour découvrir d'autres parcours.
          </p>
        </div>
      ) : (
        <div className="training-grid recommendation-grid">
          {recommendations.map((recommendation) => (
            <TrainingCard
              key={recommendation.id}
              headingLevel={3}
              training={{
                id: recommendation.id,
                title: recommendation.title,
                description: recommendation.description,
                category: {
                  id: recommendation.categoryId,
                  name: recommendation.categoryName,
                  isArchived: false,
                },
                type: recommendation.type,
                level: recommendation.level,
                durationMinutes: recommendation.durationMinutes,
                priceMinor: recommendation.priceMinor,
                thumbnailUrl: recommendation.thumbnailUrl,
              }}
              onClick={() =>
                trackRecommendationClick({
                  trainingId: recommendation.id,
                  categoryName: recommendation.categoryName,
                  rank: recommendations.indexOf(recommendation) + 1,
                })
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RoleDashboard({
  title,
  role,
  subtitle,
  error,
  retry,
  loading,
  children,
}: React.PropsWithChildren<{
  title: string;
  role: 'LEARNER' | 'TRAINER';
  subtitle: string;
  error: string;
  retry: () => Promise<void>;
  loading: boolean;
}>) {
  return (
    <section className="hsa-dashboard">
      <DashboardHero name={title} role={role} description={subtitle} />
      {error && <DashboardErrorState error={error} retry={retry} />}
      {loading ? <DashboardLoadingState /> : error ? null : children}
    </section>
  );
}
function visibleStatus(status: string): string {
  return (
    {
      DRAFT: 'Brouillon',
      PUBLISHED: 'Publiée',
      ARCHIVED: 'Archivée',
      PLANNED: 'Planifiée',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminée',
      CANCELLED: 'Annulée',
      PENDING: 'En attente',
      PAID: 'Payé',
      FAILED: 'Échoué',
      PASSED: 'Réussi',
    }[status] ?? status
  );
}
function Action(props: { to: string; title: string; text: string }) {
  const icon = props.to.includes('evaluation')
    ? ClipboardCheck
    : props.to.includes('payment')
      ? CreditCard
      : props.to.includes('attendance') || props.to.includes('session')
        ? CalendarDays
        : BookOpen;
  return <QuickActionCard {...props} icon={icon} />;
}

function TrainerSessionsPanel({ rows }: { rows: Named[] }) {
  return (
    <div className="content-card hsa-trainer-sessions">
      <DashboardSectionHeader
        title="Mes sessions planifiées"
        description="Vos prochaines interventions."
        icon={CalendarDays}
        to="/app/sessions"
        action="Voir tout le planning"
      />
      {rows.length === 0 ? (
        <p className="muted">Aucune session planifiée pour le moment.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <span className="hsa-session-date">
                <CalendarDays aria-hidden="true" size={20} />
              </span>
              <div>
                <span className="status-pill">Planifiée</span>
                <strong>{row.training?.title ?? row.title}</strong>
                {row.title && row.training && <small>{row.title}</small>}
                <small>
                  {row.startAt
                    ? new Intl.DateTimeFormat('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(row.startAt))
                    : 'Horaire à confirmer'}
                  {row.location ? ` · ${row.location}` : ''}
                  {row.room ? ` · ${row.room}` : ''}
                </small>
              </div>
              {row.enrolledCount !== undefined && (
                <span className="hsa-session-learners">
                  <UsersRound aria-hidden="true" size={15} />{' '}
                  {row.enrolledCount}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrainerActivityList({ rows }: { rows: TrainerWorkspace['activity'] }) {
  const icons = {
    ENROLLMENT: UserPlus,
    EVALUATION: FileCheck2,
    SESSION: CalendarDays,
  } as const;
  return (
    <div className="content-card hsa-activity-panel">
      <DashboardSectionHeader
        title="Activité récente"
        description="Dernières actions sur vos formations."
        icon={Activity}
      />
      {rows.length === 0 ? (
        <p className="muted">Aucune activité récente.</p>
      ) : (
        <ul>
          {rows.map((row) => {
            const Icon = icons[row.type];
            return (
              <li key={row.id}>
                <span
                  className={`hsa-icon hsa-activity-${row.type.toLowerCase()}`}
                >
                  <Icon aria-hidden="true" size={18} />
                </span>
                <div>
                  <strong>{row.title}</strong>
                  <small>{row.description}</small>
                </div>
                <time dateTime={row.occurredAt}>
                  {relativeTime(row.occurredAt)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function relativeTime(value: string) {
  const difference = Date.now() - Date.parse(value);
  const hours = Math.max(0, Math.floor(difference / 3_600_000));
  if (hours < 1) return 'À l’instant';
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} j`;
}
function Recent({
  title,
  to,
  rows,
  empty,
}: {
  title: string;
  to: string;
  rows: Named[];
  empty: string;
}) {
  return (
    <div className="content-card recent-panel">
      <DashboardSectionHeader title={title} to={to} icon={CalendarDays} />
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <span>
                <strong>{row.training?.title ?? row.title ?? 'Élément'}</strong>
                {row.startAt && (
                  <small className="hsa-row-detail">
                    {new Intl.DateTimeFormat('fr-FR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(row.startAt))}
                  </small>
                )}
                {row.location && (
                  <small className="hsa-row-detail">
                    {row.location}
                    {row.room ? ' · ' + row.room : ''}
                  </small>
                )}
                {row.enrolledCount !== undefined && (
                  <small className="hsa-row-detail">
                    {row.enrolledCount} inscrits
                  </small>
                )}
              </span>
              {row.status && (
                <span className="status-pill">{visibleStatus(row.status)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function loadProgress(
  request: ReturnType<typeof useAuth>['request'],
): Promise<Page<Progress>> {
  const first = await request<Page<Progress>>('/progress?page=1&pageSize=100');
  const items = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / 100); page++) {
    const next = await request<Page<Progress>>(
      '/progress?page=' + page + '&pageSize=100',
    );
    items.push(...next.items);
  }
  return { ...first, items };
}
