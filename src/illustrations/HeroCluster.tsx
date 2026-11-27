import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useParallax } from '../hooks/useParallax';
import { Mascot } from './Mascot';
import { Kid } from './Kid';
import { QrPassport } from './QrPassport';
import { Coins } from './Coins';
import { Floaters } from './Floaters';
import '../styles/motion.css';

type MotionStyle = CSSProperties & Record<`--${string}`, string>;
const motion = (rot: number, dx: number, dy: number, dur: number, delay: number): MotionStyle => ({
  '--rot': `${rot}deg`, '--dx': `${dx}px`, '--dy': `${dy}px`, '--drot': `${dx > 0 ? 5 : -5}deg`, '--dur': `${dur}s`, '--delay': `${delay}s`,
});

function Layer({ x, y, depth, index, style, children, action, label }: { x: number; y: number; depth: 6 | 8 | 12 | 16 | 24; index: number; style: MotionStyle; children: ReactNode; action?: 'boop' | 'stamp'; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const trigger = () => {
    if (!action) return;
    setPlaying(false);
    if (timer.current) clearTimeout(timer.current);
    requestAnimationFrame(() => setPlaying(true));
    timer.current = setTimeout(() => setPlaying(false), action === 'stamp' ? 650 : 400);
  };
  return <g transform={`translate(${x} ${y})`}>
    <g className={`parallax depth-${depth}`}>
      <g className="drop-in" style={{ '--stagger': `${index * 80}ms` } as MotionStyle}>
        <g className={`float ${playing ? action : ''} ${action ? 'hero-interactive' : ''}`} style={style}
          role={action ? 'button' : undefined} tabIndex={action ? 0 : undefined} aria-label={label}
          onClick={trigger} onKeyDown={action ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); } } : undefined}>
          {children}
          {action === 'stamp' && <circle className="stamp-ring" cx="75" cy="65" r="47" fill="none" stroke="var(--primary)" strokeWidth="3" />}
          {action === 'boop' && <g className="boop-confetti" aria-hidden="true">{[0, 60, 120, 180, 240, 300].map(a => <rect key={a} x="55" y="-8" width="5" height="12" rx="2" fill={a % 120 ? 'var(--sky)' : 'var(--pink)'} transform={`rotate(${a} 55 55)`} />)}</g>}
        </g>
      </g>
    </g>
  </g>;
}

export function HeroCluster() {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setVisible(!document.hidden && el.getBoundingClientRect().bottom > 0);
    const observer = new IntersectionObserver(([entry]) => setVisible(!document.hidden && entry.isIntersecting));
    observer.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  useParallax(ref, visible);
  return <div className="hero-cluster-wrap">
    <svg ref={ref} viewBox="0 0 520 520" role="img" aria-label="Children and a friendly lamp mascot floating around a learning passport QR card" data-paused={!visible}>
      <Layer x={305} y={215} depth={6} index={0} style={motion(5, 5, -10, 5.8, -.8)} action="boop" label="Make Deepu the lamp smile"><Mascot /></Layer>
      <Layer x={118} y={255} depth={8} index={1} style={motion(-28, 3, -10, 6, -1.2)} action="stamp" label="Stamp the learning passport"><QrPassport size={165} /></Layer>
      <Layer x={78} y={315} depth={8} index={2} style={motion(-8, 2, -4, 2.8, -.4)}><Coins /></Layer>
      <Layer x={36} y={90} depth={12} index={3} style={motion(-32, 8, -12, 5.2, -1.4)} action="boop" label="Play with a child"><Kid variant="A" /></Layer>
      <Layer x={145} y={25} depth={16} index={4} style={motion(25, -7, 11, 6.4, -2)} action="boop" label="Play with a child"><Kid variant="B" /></Layer>
      <Layer x={320} y={45} depth={12} index={5} style={motion(-18, 9, -8, 4.9, -.7)} action="boop" label="Play with a child"><Kid variant="C" /></Layer>
      <Layer x={375} y={325} depth={16} index={6} style={motion(33, -9, -13, 6.8, -2.7)} action="boop" label="Play with a child"><Kid variant="D" /></Layer>
      <Layer x={235} y={390} depth={12} index={7} style={motion(-37, 6, -9, 5.6, -1.7)} action="boop" label="Play with a child"><Kid variant="E" /></Layer>
      <Layer x={30} y={410} depth={16} index={8} style={motion(18, -8, 10, 6.1, -3)} action="boop" label="Play with the teacher"><Kid variant="F" /></Layer>
      <Layer x={5} y={20} depth={24} index={9} style={motion(10, 4, -6, 3.8, -.9)}><Floaters size={55} /></Layer>
      <Layer x={400} y={120} depth={24} index={10} style={motion(-15, -5, 5, 4.4, -2.1)}><Floaters size={65} /></Layer>
      <Layer x={440} y={410} depth={24} index={11} style={motion(34, 6, -5, 3.5, -1.8)}><Floaters size={48} /></Layer>
    </svg>
  </div>;
}
