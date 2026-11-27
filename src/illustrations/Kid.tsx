import type { CSSProperties } from 'react';

type Variant = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
const looks: Record<Variant, { skin: string; hair: string; shirt: string; expression: string }> = {
  A: { skin: '#C98458', hair: '#1E1B2E', shirt: 'var(--sky)', expression: 'laugh' },
  B: { skin: '#9A5F3B', hair: '#3B2416', shirt: 'var(--pink)', expression: 'grin' },
  C: { skin: '#F6C7A0', hair: '#C5832B', shirt: 'var(--teal)', expression: 'surprise' },
  D: { skin: '#E9A97C', hair: '#7A4A1E', shirt: 'var(--violet)', expression: 'sleepy' },
  E: { skin: '#6B3F26', hair: '#1E1B2E', shirt: 'var(--primary)', expression: 'cheeky' },
  F: { skin: '#C98458', hair: '#3B2416', shirt: 'var(--pink)', expression: 'surprise' },
};

export function Kid({ variant, size = 90, className, style }: { variant: Variant; size?: number; className?: string; style?: CSSProperties }) {
  const k = looks[variant];
  return <g className={className} style={style} transform={`scale(${size / 90})`}>
    <ellipse cx="30" cy="77" rx="7" ry="14" fill={k.shirt} transform="rotate(28 30 77)" /><ellipse cx="61" cy="77" rx="7" ry="14" fill={k.shirt} transform="rotate(-28 61 77)" />
    <rect x="25" y="51" width="42" height="29" rx="15" fill={k.shirt} />
    <ellipse cx="20" cy="61" rx="7" ry="14" fill={k.skin} transform="rotate(35 20 61)" /><ellipse className={variant === 'E' ? 'wave' : undefined} cx="72" cy="60" rx="7" ry="14" fill={k.skin} transform="rotate(-35 72 60)" />
    <circle cx="46" cy="31" r="28" fill={k.skin} />
    {variant === 'B' ? <path d="M16 30 Q13 -1 46 2 Q82 2 77 37 L69 28 Q47 15 22 36Z" fill={k.shirt} /> :
      variant === 'A' ? <><path d="M18 22 Q24 -5 51 2 Q72 4 74 24Z" fill={k.hair} /><rect x="14" y="20" width="62" height="10" rx="5" fill="var(--violet)" /></> :
      variant === 'D' ? <path d="M19 23 Q28 -4 61 7 Q74 16 72 29 Q45 17 19 30Z" fill={k.hair} /> :
      variant === 'F' ? <path d="M17 25 Q24 -2 52 4 Q73 8 74 26Z" fill={k.hair} /> :
      <path d="M17 24 Q20 0 48 4 Q74 2 75 29 Q64 17 56 21 Q39 10 17 28Z" fill={k.hair} />}
    {variant === 'E' && <rect x="22" y="21" width="49" height="5" rx="2" fill="var(--sky)" />}
    <g className="blink"><ellipse cx="36" cy="33" rx="2.8" ry="4" fill="#1E1B2E" /><ellipse cx="57" cy="33" rx="2.8" ry="4" fill="#1E1B2E" /></g>
    {k.expression === 'sleepy' ? <path d="M36 47 Q46 44 56 47 L56 49 Q46 46 36 49Z" fill="#3B2416" /> :
      k.expression === 'surprise' ? <ellipse cx="47" cy="47" rx="4" ry="6" fill="#3B2416" /> :
      <path d="M35 44 Q47 57 59 44 Q49 50 35 44Z" fill="#3B2416" />}
    {variant === 'F' && <path d="M37 40 Q46 44 55 40 L55 43 Q46 47 37 43Z" fill={k.hair} />}
    {variant === 'D' && <circle cx="67" cy="23" r="2.5" fill="var(--pink)" />}
  </g>;
}
