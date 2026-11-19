/** Open book with a star — the app mark (also public/logo.svg). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="rgb(var(--c-primary))" />
      <path d="M12 22c7-3 14-3 20 1v25c-6-4-13-4-20-1z" fill="rgb(var(--c-surface))" />
      <path d="M52 22c-7-3-14-3-20 1v25c6-4 13-4 20-1z" fill="rgb(var(--c-surface))" opacity=".9" />
      <path d="M32 9l2.4 5 5.4.7-4 3.7 1.1 5.4-4.9-2.7-4.9 2.7 1.1-5.4-4-3.7 5.4-.7z" fill="rgb(var(--c-star))" />
    </svg>
  );
}
