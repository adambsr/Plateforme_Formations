import { formatPrice, formatDuration, typeLabel } from './presentation.js';
import { useState, type MouseEventHandler } from 'react';
import { ImageOff } from 'lucide-react';
import { Link } from 'react-router';
import { apiAssetUrl } from '../../core/api/client.js';
import type { Training } from './types.js';

export function TrainingImage({
  training,
}: {
  training: Pick<Training, 'title' | 'thumbnailUrl'>;
}) {
  const [unavailable, setUnavailable] = useState(false);
  return training.thumbnailUrl === undefined || unavailable ? (
    <div
      className="training-thumbnail training-thumbnail-fallback"
      role="img"
      aria-label="Aucune miniature disponible"
    >
      <ImageOff aria-hidden="true" size={27} strokeWidth={1.7} />
      <span>Image indisponible</span>
    </div>
  ) : (
    <img
      className="training-thumbnail"
      width={640}
      height={400}
      loading="lazy"
      decoding="async"
      src={apiAssetUrl(training.thumbnailUrl)}
      alt={`Miniature de la formation ${training.title}`}
      onError={() => setUnavailable(true)}
    />
  );
}

export function TrainingCard({
  training,
  headingLevel = 2,
  onClick,
}: {
  training: Pick<
    Training,
    | 'id'
    | 'title'
    | 'description'
    | 'category'
    | 'type'
    | 'level'
    | 'durationMinutes'
    | 'priceMinor'
    | 'thumbnailUrl'
  >;
  headingLevel?: 2 | 3;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <Link
      className="training-card-link"
      to={`/trainings/${training.id}`}
      onClick={onClick}
    >
      <article className="training-card">
        <TrainingImage training={training} />
        <div className="training-card-meta">
          <span className={`type-badge type-${training.type.toLowerCase()}`}>
            {typeLabel(training.type)}
          </span>
          <span>{training.category.name}</span>
        </div>
        <Heading>{training.title}</Heading>
        <p className="muted training-summary">{training.description}</p>
        <dl className="training-facts">
          <div>
            <dt>Niveau</dt>
            <dd>{training.level}</dd>
          </div>
          <div>
            <dt>Durée</dt>
            <dd>{formatDuration(training.durationMinutes)}</dd>
          </div>
          <div>
            <dt>Prix</dt>
            <dd>{formatPrice(training.priceMinor)}</dd>
          </div>
        </dl>
        <span className="training-card-action">Voir la formation</span>
      </article>
    </Link>
  );
}
