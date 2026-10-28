import { useId } from 'react';

// A woven band in the spirit of Al Sadu textiles: rows of triangles and a
// diamond chain. Used where a school has no photo.
export function SaduBand({ color, className = '' }: { color: string; className?: string }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 240 96" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id={`${id}-tri`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 24 12 4l12 20Z" fill={color} fillOpacity="0.85" />
          <path d="M12 4 24 24" stroke="var(--ink)" strokeOpacity="0.25" />
        </pattern>
        <pattern id={`${id}-dia`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M8 1 15 8 8 15 1 8Z" fill="none" stroke="var(--ink)" strokeOpacity="0.5" strokeWidth="1.2" />
          <circle cx="8" cy="8" r="1.6" fill={color} />
        </pattern>
      </defs>
      <rect width="240" height="96" fill="var(--surface-strong)" />
      <rect y="8" width="240" height="24" fill={`url(#${id}-tri)`} />
      <rect y="40" width="240" height="16" fill={`url(#${id}-dia)`} />
      <rect y="64" width="240" height="24" fill={`url(#${id}-tri)`} transform="rotate(180 120 76)" />
      <path d="M0 36h240M0 60h240" stroke="var(--ink)" strokeOpacity="0.2" />
    </svg>
  );
}
