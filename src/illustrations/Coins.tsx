import type { CSSProperties } from 'react';
export function Coins({ size = 80, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return <g className={className} style={style} transform={`scale(${size / 80})`}>
    {[{x:12,y:44},{x:33,y:52},{x:51,y:35}].map((p,i) => <g key={i}><ellipse cx={p.x} cy={p.y+6} rx="14" ry="7" fill="var(--coin-d)" /><ellipse cx={p.x} cy={p.y} rx="14" ry="7" fill="var(--coin)" /><ellipse cx={p.x} cy={p.y-2} rx="7" ry="2" fill="white" opacity=".6" /></g>)}
  </g>;
}
