import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { n } from '../../lib/format';
import type { DoneView, ReviewItem } from '../../lib/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StarIcon } from '../../components/StarIcon';
import { LevelPills } from './HeaderCard';
import { useHome } from './useHome';

const BONUS = 2;
const MAX_STARS_SHOWN = 32;

function message(correct: number, total: number) {
  const m = ar.result.messages;
  if (total > 0 && correct === total) return m.perfect;
  const r = total ? correct / total : 0;
  return r >= 0.8 ? m.great : r >= 0.5 ? m.good : r > 0 ? m.some : m.zero;
}

export function ResultView({ data, celebrate }: { data: DoneView; celebrate: boolean }) {
  const { result, review, quiz } = data;
  const [open, setOpen] = useState(!celebrate);
  const home = useHome();
  const pending = review.some((r) => r.essay?.status === 'pending');
  const shown = Math.min(result.stars, MAX_STARS_SHOWN);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-center gap-3 text-center">
        <p className="font-scripture text-muted">{ar.chapter(quiz.book, quiz.chapter)}</p>
        <h1 className="text-3xl font-bold">{ar.score(result.correct, result.total)}</h1>
        <p role="status" className="text-lg">{message(result.correct, result.total)}</p>
        <div className="flex min-h-8 flex-wrap justify-center gap-1" aria-label={ar.stars(result.stars)}>
          {Array.from({ length: shown }, (_, k) => (
            <span key={k} className={celebrate ? 'star-pop' : ''} style={celebrate ? { animationDelay: `${k * 90}ms` } : undefined}>
              <StarIcon size={28} />
            </span>
          ))}
        </div>
        <p className="font-semibold">{ar.stars(result.stars)}</p>
        {result.perfect && <p className="text-star">{ar.result.perfectBonus(BONUS)}</p>}
        {home.data && <LevelPills stats={home.data.stats} />}
        {pending && <p className="text-sm text-muted">{ar.result.pendingNote}</p>}
        <div className="flex w-full gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? ar.result.hideAnswers : ar.result.showAnswers}
          </Button>
          <Link to="/" className="btn btn-primary flex-1">{ar.play.backHome}</Link>
        </div>
      </Card>
      {open && <ol className="flex flex-col gap-3">{review.map((r, i) => <ReviewCard key={i} item={r} index={i} />)}</ol>}
    </div>
  );
}

function ReviewCard({ item, index }: { item: ReviewItem; index: number }) {
  const mark = item.correct === null ? '⏳' : item.correct ? '✓' : '✗';
  return (
    <li>
      <Card className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <span className={`text-lg ${item.correct === null ? 'text-muted' : item.correct ? 'text-success' : 'text-danger'}`} aria-hidden="true">{mark}</span>
          <h3 className="flex-1 font-scripture leading-loose">{n(index + 1)}. {item.q}</h3>
        </div>
        {item.type !== 'essay' ? (
          <ul className="flex flex-col gap-1">
            {item.options.map((o, k) => {
              const right = k === item.answer;
              const mine = k === item.yours;
              return (
                <li key={k} className={`rounded-lg px-3 py-2 ${right ? 'bg-success/15 text-success' : mine ? 'bg-danger/10 text-danger' : 'text-muted'}`}>
                  {o}
                  {right && <span className="ms-2 text-xs">({ar.result.correctAnswer})</span>}
                  {mine && !right && <span className="ms-2 text-xs">({ar.result.yourAnswer})</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p><strong>{ar.result.yourAnswer}:</strong> {String(item.yours ?? '')}</p>
            <p><strong>{ar.result.modelAnswer}:</strong> {item.model}</p>
            <p>
              {item.essay?.status === 'pending' ? ar.result.pending : item.essay?.status === 'ok' ? ar.result.essayOk : ar.result.essayNo}
              {item.essay?.note && <span className="ms-2 text-muted">— {item.essay.note}</span>}
            </p>
          </div>
        )}
      </Card>
    </li>
  );
}
