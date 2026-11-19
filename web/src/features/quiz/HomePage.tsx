import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { fmtDate, fmtShortDate, fmtTime, n } from '../../lib/format';
import { studentToken } from '../../lib/session';
import type { Home, HomeQuiz } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBox, Loading } from '../../components/Feedback';
import { Page } from '../../components/Page';
import { Pill } from '../../components/Pill';
import { StarIcon } from '../../components/StarIcon';
import { Tabs } from '../../components/Tabs';
import { HeaderCard } from './HeaderCard';
import { useHome } from './useHome';

type Tab = 'today' | 'record' | 'board';

export function HomePage() {
  const home = useHome();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = (['today', 'record', 'board'].includes(params.get('tab') ?? '') ? params.get('tab') : 'today') as Tab;

  const logout = async () => {
    try { await api('logout'); } catch { /* token is cleared anyway */ }
    studentToken.clear();
    qc.clear();
  };

  return (
    <Page actions={<Button variant="ghost" small onClick={logout}>{ar.logout}</Button>}>
      {home.isPending && <Loading />}
      {home.isError && <ErrorBox error={home.error} onRetry={() => home.refetch()} />}
      {home.data && (
        <>
          <HeaderCard name={home.data.me.name} stats={home.data.stats} />
          <Tabs<Tab>
            label={ar.appName}
            value={tab}
            onChange={(t) => setParams(t === 'today' ? {} : { tab: t }, { replace: true })}
            tabs={[['today', ar.home.tabs.today], ['record', ar.home.tabs.record], ['board', ar.home.tabs.board]]}
          />
          <div role="tabpanel">
            {tab === 'today' && <TodayTab data={home.data} />}
            {tab === 'record' && <RecordTab data={home.data} />}
            {tab === 'board' && <BoardTab data={home.data} />}
          </div>
        </>
      )}
    </Page>
  );
}

function QuizTitle({ q }: { q: HomeQuiz }) {
  return <p className="font-scripture text-lg font-semibold">{ar.chapter(q.book, q.chapter)}</p>;
}

function TodayTab({ data }: { data: Home }) {
  const today = data.quizzes.filter((q) => q.date === data.today);
  const unlocked = data.quizzes.filter((q) => q.date !== data.today && q.state === 'open');
  const missed = data.quizzes.filter((q) => q.state === 'missed');
  const assignments = data.assignments;
  const nothing = today.length + unlocked.length + assignments.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{fmtDate(data.today)}</p>

      {today.map((q) => (
        <Card key={q.id} className="flex flex-col gap-3">
          <p className="text-sm text-muted">{ar.home.todayQuiz}</p>
          <QuizTitle q={q} />
          {q.state === 'open' && <Link to={`/quiz/${q.id}`} className="btn btn-primary w-full">{ar.home.start}</Link>}
          {q.state === 'waiting' && <Pill>{ar.home.opensAt(fmtTime(q.opensAt))}</Pill>}
          {q.state === 'author' && <p className="text-muted">{ar.home.author}</p>}
          {q.state === 'done' && q.result && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{ar.home.done} — {ar.score(q.result.correct, q.result.total)} · <StarIcon size={16} /> {n(q.result.stars)}</span>
              <Link to={`/quiz/${q.id}`} className="btn btn-secondary btn-sm">{ar.home.review}</Link>
            </div>
          )}
        </Card>
      ))}

      {assignments.map((a) => (
        <Card key={a.id} className="flex flex-col gap-2">
          <p className="text-sm text-muted">{ar.home.assignmentTitle}</p>
          <p className="font-scripture text-lg font-semibold">{ar.chapter(a.book, a.chapter)}</p>
          {a.status === 'open'
            ? <Link to={`/write/${a.id}`} className="btn btn-primary w-full">{ar.home.assignmentWrite}</Link>
            : <Pill tone="success">{ar.home.assignmentSent}</Pill>}
        </Card>
      ))}

      {unlocked.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">{ar.home.unlockedTitle}</h2>
          {unlocked.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-2">
              <span>{ar.chapter(q.book, q.chapter)} · {fmtShortDate(q.date)}</span>
              <Link to={`/quiz/${q.id}`} className="btn btn-primary btn-sm">{ar.home.start}</Link>
            </div>
          ))}
        </Card>
      )}

      {nothing && <EmptyState title={ar.home.emptyTodayTitle} text={ar.home.emptyToday} />}

      {missed.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">{ar.home.missedTitle}</h2>
          <p className="text-sm text-muted">{ar.home.missedHint}</p>
          <ul className="flex flex-col gap-1">
            {missed.map((q) => <li key={q.id} className="text-muted">{ar.chapter(q.book, q.chapter)} · {fmtShortDate(q.date)}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

function RecordTab({ data }: { data: Home }) {
  const done = data.quizzes.filter((q) => q.state === 'done' && q.result);
  if (done.length === 0) return <EmptyState title={ar.home.emptyRecordTitle} text={ar.home.emptyRecord} icon="⭐" />;
  return (
    <ul className="flex flex-col gap-3">
      {done.map((q) => (
        <li key={q.id}>
          <Card className="flex items-center justify-between gap-3">
            <div>
              <QuizTitle q={q} />
              <p className="text-sm text-muted">{fmtShortDate(q.date)} · {ar.score(q.result!.correct, q.result!.total)} · <StarIcon size={14} /> {n(q.result!.stars)}</p>
            </div>
            <Link to={`/quiz/${q.id}`} className="btn btn-secondary btn-sm">{ar.home.review}</Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function BoardTab({ data }: { data: Home }) {
  if (!data.board) return <EmptyState title={ar.home.boardHiddenTitle} text={ar.home.boardHidden} icon="🔒" />;
  if (data.board.length === 0) return <EmptyState title={ar.home.boardEmpty} />;
  return (
    <Card className="p-0">
      <ol className="divide-y divide-border">
        {data.board.map((r, i) => (
          <li key={i} aria-current={r.me || undefined} className={`flex items-center gap-3 px-4 py-3 ${r.me ? 'bg-star/15 font-bold' : ''}`}>
            <span className="w-8 text-center text-lg">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : n(r.rank)}</span>
            <span className="flex-1">{r.name} {r.me && <span className="text-sm text-muted">{ar.home.you}</span>}</span>
            <span className="text-sm text-muted">🔥 {n(r.streak)}</span>
            <span className="flex items-center gap-1"><StarIcon size={16} />{n(r.stars)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
