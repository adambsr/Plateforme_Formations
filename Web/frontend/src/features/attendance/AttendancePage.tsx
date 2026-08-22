import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { formatTunisDate } from '../sessions/time.js';
import type {
  AttendanceSessionPage,
  AttendanceStatus,
  SessionAttendance,
} from './types.js';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function learnerName(learner: {
  email: string;
  firstName?: string;
  lastName?: string;
}): string {
  return (
    [learner.firstName, learner.lastName].filter(Boolean).join(' ') ||
    learner.email
  );
}

function statusLabel(status: AttendanceStatus | null): string {
  if (status === 'PRESENT') return 'Présent';
  if (status === 'ABSENT') return 'Absent';
  return 'Non saisie';
}

export function AttendancePage() {
  const { user, request } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSessionPage | null>(null);
  const [selected, setSelected] = useState<SessionAttendance | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingScheduleId, setSavingScheduleId] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDetail = useCallback(
    async (sessionId: string) => {
      setLoadingDetail(true);
      setError('');
      try {
        setSelected(
          await request<SessionAttendance>(`/sessions/${sessionId}/attendance`),
        );
      } catch (caught) {
        setError(message(caught));
      } finally {
        setLoadingDetail(false);
      }
    },
    [request],
  );

  const load = useCallback(async () => {
    if (user === null) return;
    setError('');
    try {
      const view = user.role === 'LEARNER' ? 'ENROLLED' : 'MANAGED';
      const result = await request<AttendanceSessionPage>(
        `/sessions?view=${view}&pageSize=100`,
      );
      const visible =
        user.role === 'TRAINER'
          ? result.items.filter((session) =>
              session.assignedTrainers.some(({ id }) => id === user.id),
            )
          : result.items;
      const next = { ...result, items: visible, total: visible.length };
      setSessions(next);
      if (visible[0] !== undefined) await loadDetail(visible[0].id);
      else setSelected(null);
    } catch (caught) {
      setError(message(caught));
    }
  }, [loadDetail, request, user]);

  useEffect(() => {
    // Route entry synchronizes role-filtered Sessions and Attendance state.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function saveSchedule(
    scheduleId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (selected === null) return;
    setSavingScheduleId(scheduleId);
    setError('');
    setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const entries = selected.roster.map(({ enrollmentId }) => ({
        enrollmentId,
        status: String(form.get(enrollmentId)) as AttendanceStatus,
      }));
      setSelected(
        await request<SessionAttendance>(
          `/schedules/${scheduleId}/attendance`,
          { method: 'PUT', body: JSON.stringify({ entries }) },
        ),
      );
      setNotice('Présences enregistrées.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSavingScheduleId(undefined);
    }
  }

  if (user === null) return null;
  const staff = user.role === 'ADMIN' || user.role === 'TRAINER';
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Présentiel</span>
          <h1>{staff ? 'Gestion des présences' : 'Mon planning'}</h1>
        </div>
        {sessions !== null && (
          <span className="count-badge">{sessions.total}</span>
        )}
      </div>
      {notice !== '' && <p className="success-message">{notice}</p>}
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {sessions === null && error === '' ? (
        <p className="muted">Chargement des sessions…</p>
      ) : sessions?.items.length === 0 ? (
        <div className="empty-state">
          <h2>Aucune session concernée</h2>
          <p className="muted">
            {staff
              ? 'Les sessions auxquelles vous êtes affecté apparaîtront ici.'
              : 'Votre planning apparaîtra après confirmation du paiement.'}
          </p>
        </div>
      ) : (
        <>
          <div className="attendance-session-tabs">
            {sessions?.items.map((session) => (
              <button
                key={session.id}
                className={
                  selected?.session.id === session.id
                    ? 'primary-button compact-button'
                    : 'secondary-button compact-button'
                }
                onClick={() => void loadDetail(session.id)}
              >
                {session.title}
              </button>
            ))}
          </div>
          {loadingDetail ? (
            <p className="muted">Chargement des présences…</p>
          ) : selected !== null ? (
            <div className="attendance-workspace">
              <div className="content-card attendance-summary">
                <div>
                  <span
                    className={`status-pill status-${selected.session.status.toLowerCase()}`}
                  >
                    {selected.session.status}
                  </span>
                  <h2>{selected.session.training.title}</h2>
                  <p>{selected.session.title}</p>
                </div>
                <strong>
                  Seuil requis : {selected.minimumAttendancePercent}%
                </strong>
              </div>
              {selected.schedules.length === 0 ? (
                <p className="muted">Aucune date planifiée.</p>
              ) : staff ? (
                selected.schedules.map((schedule) => (
                  <form
                    className="content-card attendance-sheet"
                    key={schedule.id}
                    onSubmit={(event) => void saveSchedule(schedule.id, event)}
                  >
                    <div className="managed-training-heading">
                      <div>
                        <h3>{formatTunisDate(schedule.startAt)}</h3>
                        <p className="muted">
                          {schedule.location}
                          {schedule.room === undefined
                            ? ''
                            : ` · ${schedule.room}`}
                        </p>
                      </div>
                    </div>
                    {selected.roster.length === 0 ? (
                      <p className="muted">Aucun apprenant inscrit.</p>
                    ) : (
                      <div className="attendance-roster">
                        {selected.roster.map((row) => {
                          const record = row.records.find(
                            ({ scheduleId }) => scheduleId === schedule.id,
                          );
                          return (
                            <label key={row.enrollmentId}>
                              <span>
                                <strong>{learnerName(row.learner)}</strong>
                                <small>{row.learner.email}</small>
                              </span>
                              <select
                                name={row.enrollmentId}
                                defaultValue={record?.status ?? ''}
                                required
                                disabled={!selected.canRecord}
                              >
                                <option value="" disabled>
                                  Non saisie
                                </option>
                                <option value="PRESENT">Présent</option>
                                <option value="ABSENT">Absent</option>
                              </select>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {selected.canRecord && selected.roster.length > 0 && (
                      <button
                        className="primary-button compact-button"
                        disabled={savingScheduleId !== undefined}
                      >
                        {savingScheduleId === schedule.id
                          ? 'Enregistrement…'
                          : 'Enregistrer cette date'}
                      </button>
                    )}
                    {selected.immutable && (
                      <p className="muted">
                        Présences immuables depuis la fin de la session.
                      </p>
                    )}
                  </form>
                ))
              ) : (
                <div className="learner-schedule-list">
                  {selected.schedules.map((schedule) => {
                    const record = selected.roster[0]?.records.find(
                      ({ scheduleId }) => scheduleId === schedule.id,
                    );
                    return (
                      <article className="content-card" key={schedule.id}>
                        <h3>{formatTunisDate(schedule.startAt)}</h3>
                        <p>
                          {schedule.location}
                          {schedule.room === undefined
                            ? ''
                            : ` · ${schedule.room}`}
                        </p>
                        <span
                          className={`status-pill attendance-${(record?.status ?? 'MISSING').toLowerCase()}`}
                        >
                          {statusLabel(record?.status ?? null)}
                        </span>
                      </article>
                    );
                  })}
                  {selected.roster[0] !== undefined && (
                    <div className="content-card attendance-result">
                      <strong>
                        Présence : {selected.roster[0].attendancePercentage}%
                      </strong>
                      <p className="muted">
                        {selected.roster[0].presentCount}/
                        {selected.roster[0].totalScheduleCount} date(s)
                        présente(s)
                      </p>
                      {!selected.roster[0].attendanceCoverageComplete && (
                        <p>Des présences n’ont pas encore été saisies.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
