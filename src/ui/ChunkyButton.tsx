import type { ButtonHTMLAttributes } from 'react';
export function ChunkyButton({ ghost = false, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { ghost?: boolean }) {
  return <button className={`btn-chunky ${ghost ? 'btn-chunky--ghost' : ''} ${className}`} {...props} />;
}
