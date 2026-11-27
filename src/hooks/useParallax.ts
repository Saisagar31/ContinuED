import { useEffect, type RefObject } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export function useParallax(ref: RefObject<SVGSVGElement>, active: boolean) {
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !active || reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let x = 0, y = 0, tx = 0, ty = 0, frame = 0;
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (event.clientX - box.left - box.width / 2) / (box.width / 2)));
      ty = Math.max(-1, Math.min(1, (event.clientY - box.top - box.height / 2) / (box.height / 2)));
    };
    const tick = () => {
      x += (tx - x) * .08; y += (ty - y) * .08;
      for (const depth of [6, 8, 12, 16, 24]) {
        el.style.setProperty(`--px-${depth}`, `${(x * depth).toFixed(2)}px`);
        el.style.setProperty(`--py-${depth}`, `${(y * depth).toFixed(2)}px`);
      }
      frame = requestAnimationFrame(tick);
    };
    el.addEventListener('pointermove', move);
    frame = requestAnimationFrame(tick);
    return () => { el.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, [ref, active, reduced]);
}
