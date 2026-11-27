import type { CSSProperties } from 'react';

export function Mascot({ size = 120, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return <g className={className} style={style} transform={`scale(${size / 120})`}>
    <ellipse cx="60" cy="106" rx="47" ry="12" fill="#A34A30" />
    <path d="M19 96 Q60 113 101 96 L91 113 Q60 128 29 113Z" fill="#C8643B" />
    <g className="flame"><path d="M60 4 Q91 34 89 66 Q89 96 60 101 Q30 96 31 66 Q34 45 60 4Z" fill="var(--primary)" /><path d="M58 30 Q76 52 75 73 Q75 91 59 95 Q45 88 46 74 Q47 58 58 30Z" fill="#FFC857" /></g>
    <ellipse cx="44" cy="64" rx="10" ry="12" fill="white" /><ellipse cx="70" cy="64" rx="10" ry="12" fill="white" />
    <ellipse className="blink" cx="46" cy="66" rx="3" ry="6" fill="#2B2A4C" /><ellipse className="blink" cx="71" cy="66" rx="3" ry="6" fill="#2B2A4C" />
    <circle cx="35" cy="80" r="5" fill="var(--pink)" opacity=".4" /><circle cx="82" cy="80" r="5" fill="var(--pink)" opacity=".4" />
    <path d="M50 80 Q59 90 69 80 Q59 85 50 80Z" fill="#2B2A4C" />
    <ellipse cx="20" cy="85" rx="8" ry="4" fill="var(--primary)" transform="rotate(-25 20 85)" /><ellipse cx="99" cy="85" rx="8" ry="4" fill="var(--primary)" transform="rotate(25 99 85)" />
  </g>;
}
