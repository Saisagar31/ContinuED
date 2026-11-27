import type { CSSProperties } from 'react';
export function Floaters({ size = 100, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return <g className={className} style={style} aria-hidden="true" transform={`scale(${size / 100})`}>
    <path d="M21 4 L26 16 L39 17 L29 25 L32 38 L21 31 L10 38 L13 25 L3 17 L16 16Z" fill="var(--coin)" />
    <rect x="58" y="8" width="8" height="26" rx="4" fill="var(--pink)" transform="rotate(24 62 21)" />
    <rect x="77" y="43" width="6" height="18" rx="3" fill="var(--sky)" transform="rotate(-26 80 52)" />
    <rect x="11" y="61" width="34" height="27" rx="5" fill="var(--violet)" /><path d="M28 66 L28 83" stroke="white" strokeWidth="2" /><path d="M16 66 Q23 62 28 68 Q34 62 40 66" fill="none" stroke="white" strokeWidth="2" />
  </g>;
}
