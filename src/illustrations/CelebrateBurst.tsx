import { Mascot } from './Mascot';

/** Optional visual for a future success screen; no workflow depends on it. */
export function CelebrateBurst() {
  return <svg className="celebrate-burst" viewBox="0 0 180 170" role="img" aria-label="Deepu the lamp celebrating with stars">
    <g transform="translate(31 28)"><Mascot size={120} /></g>
    <path d="M19 24 L23 33 L32 36 L23 39 L19 48 L15 39 L6 36 L15 33Z" fill="var(--coin)" />
    <path d="M152 9 L156 18 L165 21 L156 24 L152 33 L148 24 L139 21 L148 18Z" fill="var(--coin)" />
    <circle cx="152" cy="135" r="6" fill="var(--pink)" /><circle cx="21" cy="129" r="5" fill="var(--sky)" />
  </svg>;
}
