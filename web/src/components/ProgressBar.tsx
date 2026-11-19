export function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className="h-3 w-full overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-star transition-[width] duration-700" style={{ width: `${v * 100}%` }} />
    </div>
  );
}
