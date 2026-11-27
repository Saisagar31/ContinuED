import type { CSSProperties } from 'react';

const cells = [0,1,2,4,5,6,7,9,11,13,14,16,17,18,20,21,23,25,27,28,29,31,32,34,35,37,39,41,42,43,44,46,48];
export function QrPassport({ size = 150, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return <g className={className} style={style} transform={`scale(${size / 150})`}>
    <rect x="6" y="12" width="138" height="120" rx="17" fill="var(--teal-d)" />
    <rect x="6" y="3" width="138" height="120" rx="17" fill="var(--teal)" />
    <rect x="20" y="17" width="110" height="91" rx="10" fill="#D9F7F1" />
    <rect x="32" y="29" width="61" height="61" rx="3" fill="white" />
    {cells.map(i => <rect key={i} x={35 + (i % 7) * 8} y={32 + Math.floor(i / 7) * 8} width="6" height="6" rx="1" fill="#2B2A4C" />)}
    <circle cx="111" cy="78" r="12" fill="var(--primary)" /><path d="M106 78 L110 82 L117 73" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </g>;
}
