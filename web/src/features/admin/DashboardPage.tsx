import { useMutation } from '@tanstack/react-query';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { n } from '../../lib/format';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { Pill } from '../../components/Pill';
import { useDashboard, useRefresh } from './useAdmin';

export function DashboardPage() {
  const d = useDashboard();
  const refresh = useRefresh();
  const toggle = useMutation({ mutationFn: (value: boolean) => api('admin_set_leaderboard', { value }), onSuccess: refresh });
  if (d.isPending) return <Loading />;
  if (d.isError) return <ErrorBox error={d.error} onRetry={() => d.refetch()} />;
  const { counts, students } = d.data;
  const t = ar.admin.table;
  const c = ar.admin.counts;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([[counts.students, c.students], [counts.finishedToday, c.finishedToday], [counts.waitingAssignments, c.waiting], [counts.pendingEssays, c.pending]] as const).map(([v, label]) => (
          <Card key={label} className="text-center">
            <p className="text-3xl font-bold text-primary">{n(v)}</p>
            <p className="text-sm text-muted">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{ar.admin.leaderboard}</p>
          <p className="text-sm text-muted">{ar.admin.leaderboardHint}</p>
        </div>
        <button
          type="button" role="switch" aria-checked={d.data.leaderboardPublic} aria-label={ar.admin.leaderboard}
          disabled={toggle.isPending} onClick={() => toggle.mutate(!d.data.leaderboardPublic)}
          className={`switch ${d.data.leaderboardPublic ? 'switch-on' : ''}`}
        >
          <span className="switch-knob" />
          <span className="sr-only">{d.data.leaderboardPublic ? ar.admin.leaderboardOn : ar.admin.leaderboardOff}</span>
        </button>
        {toggle.isError && <ErrorBox error={toggle.error} />}
      </Card>

      {students.length === 0 ? (
        <EmptyState title={ar.admin.students.empty} icon="👥" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr><th>{t.name}</th><th>{t.activated}</th><th>{t.stars}</th><th>{t.streak}</th><th>{t.done}</th><th>{t.today}</th><th>{t.level}</th></tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}<div className="text-xs text-muted">{s.username}</div></td>
                  <td>
                    <Pill tone={s.activated ? 'success' : 'neutral'}>{s.activated ? ar.admin.activated : ar.admin.notActivated}</Pill>
                    {s.locked && <Pill tone="danger">{ar.admin.locked}</Pill>}
                  </td>
                  <td>{n(s.stars)}</td>
                  <td>{n(s.streak)}</td>
                  <td>{n(s.done)}</td>
                  <td>{s.today ? ar.score(s.today.correct, s.today.total) : '—'}</td>
                  <td>{s.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
