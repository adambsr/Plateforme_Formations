import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Award,
  BookOpen,
  ChartNoAxesCombined,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export function DashboardHero({
  name,
  description,
  role = 'LEARNER',
}: {
  name: string;
  description: string;
  role?: 'LEARNER' | 'TRAINER' | 'ADMIN';
}) {
  const items =
    role === 'ADMIN'
      ? ([
          [BookOpen, 'Organiser', 'votre centre'],
          [ChartNoAxesCombined, 'Analyser', 'les résultats'],
          [Award, 'Accompagner', 'la réussite'],
        ] as const)
      : role === 'TRAINER'
        ? ([
            [BookOpen, 'Transmettre', 'vos connaissances'],
            [ChartNoAxesCombined, 'Accompagner', 'vos apprenants'],
            [Award, 'Valoriser', 'les compétences'],
          ] as const)
        : ([
            [BookOpen, 'Apprendre', 'à votre rythme'],
            [ChartNoAxesCombined, 'Progresser', 'avec des experts'],
            [Award, 'Obtenir', 'vos certifications'],
          ] as const);
  return (
    <div className="hsa-hero">
      <div className="hsa-hero-copy">
        <span className="hsa-eyebrow">
          Bonjour <span aria-hidden="true">✦</span>
        </span>
        <h1>{name}</h1>
        <p>{description}</p>
        <div className="hsa-hero-features">
          {items.map(([Icon, title, subtitle]) => (
            <div key={title}>
              <Icon aria-hidden="true" size={27} />
              <span>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        className={`hsa-hero-art hsa-hero-art-${role.toLowerCase()}`}
        aria-hidden="true"
      >
        <div className="hsa-art-orbit" />
        <div className="hsa-art-book" />
        <div className="hsa-art-book second" />
        {role === 'ADMIN' ? (
          <ChartNoAxesCombined strokeWidth={1.2} />
        ) : (
          <GraduationCap strokeWidth={1.2} />
        )}
        <Sparkles className="hsa-art-sparkle" />
      </div>
    </div>
  );
}

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
  to,
  action,
  detail,
}: {
  label: string;
  value?: ReactNode;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'purple' | 'orange';
  to?: string;
  action?: string;
  detail?: string;
}) {
  return (
    <article className="hsa-stat">
      <span className={`hsa-icon hsa-tone-${tone}`}>
        <Icon aria-hidden="true" size={25} />
      </span>
      <div>
        <h2>{label}</h2>
        <strong className="hsa-stat-value">{value ?? '—'}</strong>
        {detail && <small>{detail}</small>}
        {to && (
          <Link className="hsa-text-link" to={to}>
            {action ?? 'Voir le détail'}{' '}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

export function DashboardSectionHeader({
  title,
  description,
  icon: Icon,
  to,
  action = 'Voir tout',
  id,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  to?: string;
  action?: string;
  id?: string;
}) {
  return (
    <div className="hsa-section-heading">
      <div>
        {Icon && <Icon size={23} aria-hidden="true" />}
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {to && (
        <Link className="hsa-text-link" to={to}>
          {action} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function QuickActionCard({
  to,
  title,
  text,
  icon: Icon = ArrowRight,
}: {
  to: string;
  title: string;
  text: string;
  icon?: LucideIcon;
}) {
  return (
    <Link className="hsa-quick-action" to={to}>
      <span className="hsa-icon hsa-tone-blue">
        <Icon aria-hidden="true" size={22} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}

export function DashboardLoadingState() {
  return (
    <div className="hsa-loading" role="status">
      <span className="sr-only">Chargement du tableau de bord</span>
      {[0, 1, 2, 3].map((value) => (
        <span key={value} />
      ))}
    </div>
  );
}

export function DashboardErrorState({
  error,
  retry,
}: {
  error: string;
  retry: () => Promise<void>;
}) {
  return (
    <div className="form-error hsa-error" role="alert">
      <span>{error}</span>
      <button
        className="secondary-button compact-button"
        type="button"
        onClick={() => void retry()}
      >
        Réessayer
      </button>
    </div>
  );
}

export function DashboardModal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    heading.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', escape);
    };
  }, [close]);
  return (
    <div className="hsa-modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="hsa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="hsa-modal-heading">
          <h2 id="dashboard-modal-title" ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <button
            className="hsa-table-action"
            type="button"
            aria-label="Fermer"
            title="Fermer"
            onClick={close}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ProgressCard({
  average,
  total,
  completed,
}: {
  average?: number;
  total: number;
  completed: number;
}) {
  return (
    <section className="hsa-progress">
      <div
        className="hsa-progress-ring"
        style={{ '--progress': `${average ?? 0}%` } as CSSProperties}
        role="img"
        aria-label={`Progression moyenne : ${average === undefined ? 'aucune formation' : `${average}%`}`}
      >
        <strong>{average === undefined ? '—' : `${average}%`}</strong>
      </div>
      <div className="hsa-progress-copy">
        <h2>Ma progression en ligne</h2>
        <p>
          {total === 0
            ? 'Votre prochain parcours commence ici.'
            : completed === total
              ? 'Vous avez terminé toutes vos formations en ligne !'
              : `${completed} formation${completed > 1 ? 's' : ''} terminée${completed > 1 ? 's' : ''} sur ${total}. Chaque étape compte.`}
        </p>
        <progress
          aria-label="Progression moyenne en ligne"
          value={average ?? 0}
          max={100}
        />
        <small>
          {total === 0
            ? 'Découvrez les formations et développez de nouvelles compétences.'
            : 'Continuez sur cette lancée pour atteindre vos objectifs.'}
        </small>
      </div>
      <div className="hsa-progress-achievement">
        <span className="hsa-medal">
          <Award aria-hidden="true" size={46} />
        </span>
        <small>
          {completed > 0
            ? `${completed} réussite${completed > 1 ? 's' : ''}`
            : 'Votre prochain objectif'}
        </small>
        <Link
          className="hsa-text-link"
          to={total === 0 ? '/app/catalogue' : '/app/progress'}
        >
          {total === 0 ? 'Explorer le catalogue' : 'Voir mon parcours'}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
