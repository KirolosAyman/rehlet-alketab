import { ar } from '../../i18n/ar';
import { n } from '../../lib/format';
import type { Stats } from '../../lib/types';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { ProgressBar } from '../../components/ProgressBar';
import { StarIcon } from '../../components/StarIcon';

export function LevelPills({ stats }: { stats: Stats }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Pill tone="primary">🌱 {ar.home.level(stats.level)}</Pill>
      <Pill tone="star">{ar.streak(stats.streak)}</Pill>
    </div>
  );
}

export function HeaderCard({ name, stats }: { name: string; stats: Stats }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{ar.login.hello(name)}</h1>
        <span className="flex items-center gap-1 text-lg font-bold" aria-label={ar.stars(stats.stars)}>
          <StarIcon size={24} /> {n(stats.stars)}
        </span>
      </div>
      <LevelPills stats={stats} />
      <ProgressBar value={stats.progress} label={ar.home.level(stats.level)} />
      <p className="text-sm text-muted">
        {stats.nextLevel ? ar.home.toNext(stats.starsLeft, stats.nextLevel) : ar.home.maxLevel}
      </p>
    </Card>
  );
}
