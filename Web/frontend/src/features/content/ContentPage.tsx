import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Select } from '../../shared/components/Select.js';
import type {
  ContentLesson,
  ContentModule,
  ContentResource,
  ResourceType,
  TrainingContent,
} from './types.js';
import type { PaginatedProgress, ProgressSummary } from '../progress/types.js';
import { TutorChat } from './TutorChat.js';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

function OrderField() {
  return (
    <label>
      Ordre
      <input name="order" type="number" min="1" required />
    </label>
  );
}

function ResourceView({
  resource,
  canManage,
  mutate,
  download,
}: {
  resource: ContentResource;
  canManage: boolean;
  mutate(path: string, options: RequestInit, notice: string): Promise<void>;
  download(resource: ContentResource): Promise<void>;
}) {
  return (
    <li className={resource.isArchived ? 'archived-content' : ''}>
      <div>
        <strong>
          {resource.order}. {resource.title}
        </strong>
        <p className="muted">{resource.description}</p>
        {resource.type === 'EXTERNAL_URL' ? (
          <a href={resource.externalUrl} target="_blank" rel="noreferrer">
            Ouvrir la ressource externe
          </a>
        ) : (
          <button
            className="link-button"
            onClick={() => void download(resource)}
          >
            Télécharger {resource.file?.originalName ?? 'le fichier'}
          </button>
        )}
      </div>
      {canManage && (
        <div className="management-actions">
          <button
            className="secondary-button"
            onClick={() =>
              void mutate(
                `/resources/${resource.id}`,
                {
                  method: 'PUT',
                  body: JSON.stringify({ isArchived: !resource.isArchived }),
                },
                resource.isArchived
                  ? 'Ressource restaurée.'
                  : 'Ressource archivée.',
              )
            }
          >
            {resource.isArchived ? 'Restaurer' : 'Archiver'}
          </button>
          <button
            className="danger-button"
            onClick={() =>
              void mutate(
                `/resources/${resource.id}`,
                { method: 'DELETE' },
                'Ressource supprimée.',
              )
            }
          >
            Supprimer
          </button>
        </div>
      )}
    </li>
  );
}

function ResourceForm({
  lessonId,
  mutate,
}: {
  lessonId: string;
  mutate(path: string, options: RequestInit, notice: string): Promise<void>;
}) {
  const [type, setType] = useState<ResourceType>('EXTERNAL_URL');
  return (
    <form
      className="compact-form"
      onSubmit={(event) => {
        event.preventDefault();
        const element = event.currentTarget;
        const values = new FormData(element);
        const upload = new FormData();
        upload.set('title', field(values, 'title'));
        upload.set('description', field(values, 'description'));
        upload.set('order', field(values, 'order'));
        upload.set('type', type);
        upload.set(
          'isVisibleToLearners',
          values.get('isVisibleToLearners') === null ? 'false' : 'true',
        );
        if (type === 'EXTERNAL_URL') {
          upload.set('externalUrl', field(values, 'externalUrl'));
        } else {
          const file = values.get('file');
          if (file instanceof File) upload.set('file', file);
        }
        void mutate(
          `/lessons/${lessonId}/resources`,
          { method: 'POST', body: upload },
          'Ressource ajoutée.',
        ).then(() => element.reset());
      }}
    >
      <h4>Ajouter une ressource</h4>
      <div className="form-grid">
        <label>
          Titre
          <input name="title" required />
        </label>
        <OrderField />
        <label>
          Type
          <Select
            value={type}
            onChange={(event) => setType(event.target.value as ResourceType)}
          >
            <option value="EXTERNAL_URL">Lien HTTP(S)</option>
            <option value="FILE">Fichier protégé</option>
          </Select>
        </label>
        {type === 'EXTERNAL_URL' ? (
          <label>
            URL
            <input name="externalUrl" type="url" required />
          </label>
        ) : (
          <label>
            Fichier
            <input name="file" type="file" required />
          </label>
        )}
      </div>
      <label>
        Description
        <textarea name="description" rows={2} />
      </label>
      <label className="checkbox-label">
        <input name="isVisibleToLearners" type="checkbox" defaultChecked />
        Visible par les apprenants autorisés
      </label>
      <button className="primary-button compact-button">Ajouter</button>
    </form>
  );
}

function LessonView({
  lesson,
  canManage,
  progress,
  progressSavingLessonId,
  updateProgress,
  mutate,
  download,
}: {
  lesson: ContentLesson;
  canManage: boolean;
  progress?: ProgressSummary;
  progressSavingLessonId?: string;
  updateProgress?(lessonId: string, completed: boolean): Promise<void>;
  mutate(path: string, options: RequestInit, notice: string): Promise<void>;
  download(resource: ContentResource): Promise<void>;
}) {
  return (
    <article
      id={`lesson-${lesson.id}`}
      className={`lesson-card${lesson.isArchived ? ' archived-content' : ''}`}
    >
      <div className="managed-training-heading">
        <div>
          <span className="eyebrow">Leçon {lesson.order}</span>
          <h3>{lesson.title}</h3>
        </div>
        {canManage && (
          <div className="management-actions">
            <button
              className="secondary-button"
              onClick={() =>
                void mutate(
                  `/lessons/${lesson.id}`,
                  {
                    method: 'PUT',
                    body: JSON.stringify({ isArchived: !lesson.isArchived }),
                  },
                  lesson.isArchived ? 'Leçon restaurée.' : 'Leçon archivée.',
                )
              }
            >
              {lesson.isArchived ? 'Restaurer' : 'Archiver'}
            </button>
            <button
              className="danger-button"
              onClick={() =>
                void mutate(
                  `/lessons/${lesson.id}`,
                  { method: 'DELETE' },
                  'Leçon supprimée.',
                )
              }
            >
              Supprimer
            </button>
          </div>
        )}
      </div>
      {lesson.description !== '' && <p>{lesson.description}</p>}
      {lesson.textContent !== '' && (
        <div className="lesson-text">{lesson.textContent}</div>
      )}
      {lesson.instructions !== '' && (
        <p className="muted">{lesson.instructions}</p>
      )}
      {progress !== undefined && updateProgress !== undefined && (
        <div className="lesson-progress-control">
          <button
            className={
              progress.lessons.find(({ lessonId }) => lessonId === lesson.id)
                ?.completed
                ? 'secondary-button'
                : 'primary-button'
            }
            disabled={
              progress.lockedByCertificate ||
              progressSavingLessonId === lesson.id
            }
            onClick={() => {
              const completed =
                progress.lessons.find(({ lessonId }) => lessonId === lesson.id)
                  ?.completed ?? false;
              void updateProgress(lesson.id, !completed);
            }}
          >
            {progressSavingLessonId === lesson.id
              ? 'Enregistrement…'
              : progress.lockedByCertificate
                ? 'Progression verrouillée'
                : progress.lessons.find(
                      ({ lessonId }) => lessonId === lesson.id,
                    )?.completed
                  ? 'Marquer comme non terminée'
                  : 'Marquer comme terminée'}
          </button>
        </div>
      )}
      <ul className="resource-list">
        {lesson.resources.map((resource) => (
          <ResourceView
            key={resource.id}
            resource={resource}
            canManage={canManage}
            mutate={mutate}
            download={download}
          />
        ))}
      </ul>
      {canManage && !lesson.isArchived && (
        <ResourceForm lessonId={lesson.id} mutate={mutate} />
      )}
    </article>
  );
}

function ModuleView({
  module,
  canManage,
  progress,
  progressSavingLessonId,
  updateProgress,
  mutate,
  download,
}: {
  module: ContentModule;
  canManage: boolean;
  progress?: ProgressSummary;
  progressSavingLessonId?: string;
  updateProgress?(lessonId: string, completed: boolean): Promise<void>;
  mutate(path: string, options: RequestInit, notice: string): Promise<void>;
  download(resource: ContentResource): Promise<void>;
}) {
  return (
    <article
      className={`content-card module-card${module.isArchived ? ' archived-content' : ''}`}
    >
      <div className="managed-training-heading">
        <div>
          <span className="eyebrow">Module {module.order}</span>
          <h2>{module.title}</h2>
          <p className="muted">{module.description}</p>
        </div>
        {canManage && (
          <div className="management-actions">
            <button
              className="secondary-button"
              onClick={() =>
                void mutate(
                  `/modules/${module.id}`,
                  {
                    method: 'PUT',
                    body: JSON.stringify({ isArchived: !module.isArchived }),
                  },
                  module.isArchived ? 'Module restauré.' : 'Module archivé.',
                )
              }
            >
              {module.isArchived ? 'Restaurer' : 'Archiver'}
            </button>
            <button
              className="danger-button"
              onClick={() =>
                void mutate(
                  `/modules/${module.id}`,
                  { method: 'DELETE' },
                  'Module supprimé.',
                )
              }
            >
              Supprimer
            </button>
          </div>
        )}
      </div>
      <div className="lesson-list">
        {module.lessons.map((lesson) => (
          <LessonView
            key={lesson.id}
            lesson={lesson}
            canManage={canManage}
            progress={progress}
            progressSavingLessonId={progressSavingLessonId}
            updateProgress={updateProgress}
            mutate={mutate}
            download={download}
          />
        ))}
      </div>
      {canManage && !module.isArchived && (
        <form
          className="compact-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const element = event.currentTarget;
            const values = new FormData(element);
            void mutate(
              `/modules/${module.id}/lessons`,
              {
                method: 'POST',
                body: JSON.stringify({
                  title: field(values, 'title'),
                  description: field(values, 'description'),
                  textContent: field(values, 'textContent'),
                  instructions: field(values, 'instructions'),
                  order: Number(field(values, 'order')),
                }),
              },
              'Leçon ajoutée.',
            ).then(() => element.reset());
          }}
        >
          <h3>Ajouter une leçon</h3>
          <div className="form-grid">
            <label>
              Titre
              <input name="title" required />
            </label>
            <OrderField />
          </div>
          <label>
            Description
            <textarea name="description" rows={2} />
          </label>
          <label>
            Contenu textuel
            <textarea name="textContent" rows={5} />
          </label>
          <label>
            Instructions
            <textarea name="instructions" rows={3} />
          </label>
          <button className="primary-button compact-button">
            Ajouter la leçon
          </button>
        </form>
      )}
    </article>
  );
}

export function ContentPage() {
  const { trainingId } = useParams();
  const { user, request, download } = useAuth();
  const [content, setContent] = useState<TrainingContent | null>(null);
  const [loading, setLoading] = useState(trainingId !== undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<ProgressSummary | undefined>();
  const [progressSavingLessonId, setProgressSavingLessonId] =
    useState<string>();

  const load = useCallback(async () => {
    if (trainingId === undefined) return;
    setLoading(true);
    setError('');
    try {
      const nextContent = await request<TrainingContent>(
        `/trainings/${trainingId}/content`,
      );
      setContent(nextContent);
      if (user?.role === 'LEARNER') {
        const page = await request<PaginatedProgress>(
          `/progress?trainingId=${trainingId}`,
        );
        setProgress(page.items[0]);
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request, trainingId, user]);

  useEffect(() => {
    // Route entry synchronizes the authorized server-owned content tree.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function mutate(path: string, options: RequestInit, success: string) {
    setError('');
    setNotice('');
    try {
      await request(path, options);
      setNotice(success);
      await load();
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function downloadResource(resource: ContentResource) {
    if (resource.file === undefined) return;
    try {
      const blob = await download(`/resources/${resource.id}/download`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = resource.file.originalName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function updateProgress(lessonId: string, completed: boolean) {
    if (progressSavingLessonId !== undefined) return;
    setProgressSavingLessonId(lessonId);
    setError('');
    setNotice('');
    try {
      setProgress(
        await request<ProgressSummary>(`/progress/lessons/${lessonId}`, {
          method: 'PUT',
          body: JSON.stringify({ completed }),
        }),
      );
      setNotice(
        completed
          ? 'Leçon marquée comme terminée.'
          : 'Progression mise à jour.',
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setProgressSavingLessonId(undefined);
    }
  }

  const canManage = content?.access === 'MANAGE';
  return (
    <section>
      <Link to={user?.role === 'LEARNER' ? '/app/catalogue' : '/app/trainings'}>
        ← Retour aux formations
      </Link>
      <div className="section-heading content-heading">
        <div>
          {/* <span className="eyebrow">Contenu protégé</span> */}
          <h1>{canManage ? 'Auteur de contenu' : 'Contenu de la formation'}</h1>
        </div>
        {content !== null && (
          <span className="count-badge">
            {content.modules.length} module(s)
          </span>
        )}
      </div>
      {notice !== '' && <p className="success-message">{notice}</p>}
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Chargement du contenu…</p>
      ) : content === null ? null : (
        <>
          {progress !== undefined && (
            <div className="content-card progress-summary">
              <div>
                <strong>{progress.percentage}% terminé</strong>
                <p className="muted">
                  {progress.completedLessonCount}/{progress.totalLessonCount}{' '}
                  leçon(s)
                </p>
              </div>
              <progress max="100" value={progress.percentage}>
                {progress.percentage}%
              </progress>
            </div>
          )}
          {content.access === 'LEARNER_READ' && <TutorChat content={content} />}
          {canManage && (
            <form
              className="content-card module-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                const element = event.currentTarget;
                const values = new FormData(element);
                void mutate(
                  `/trainings/${content.trainingId}/modules`,
                  {
                    method: 'POST',
                    body: JSON.stringify({
                      title: field(values, 'title'),
                      description: field(values, 'description'),
                      order: Number(field(values, 'order')),
                    }),
                  },
                  'Module ajouté.',
                ).then(() => element.reset());
              }}
            >
              <h2>Ajouter un module</h2>
              <div className="form-grid">
                <label>
                  Titre
                  <input name="title" required />
                </label>
                <OrderField />
              </div>
              <label>
                Description
                <textarea name="description" rows={2} />
              </label>
              <button className="primary-button">Ajouter le module</button>
            </form>
          )}
          {content.modules.length === 0 ? (
            <div className="empty-state">
              <h2>Aucun contenu disponible</h2>
              <p className="muted">Les modules apparaîtront ici.</p>
            </div>
          ) : (
            <div className="module-list">
              {content.modules.map((module) => (
                <ModuleView
                  key={module.id}
                  module={module}
                  canManage={canManage}
                  progress={progress}
                  progressSavingLessonId={progressSavingLessonId}
                  updateProgress={
                    user?.role === 'LEARNER' ? updateProgress : undefined
                  }
                  mutate={mutate}
                  download={downloadResource}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
