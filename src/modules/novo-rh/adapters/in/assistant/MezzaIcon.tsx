import { useId } from "react";

/**
 * Identidade do Assistente Mezza: círculo navy, aro cobre, "M" em fita
 * off-white e estrela cobre por cima do V (referência do utilizador,
 * 2026-10-14). SVG próprio, sem dependências; o brilho é do contentor (CSS).
 */
export function MezzaIcon({ size = 56, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}bg`} cx="38%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#2c4fae" />
          <stop offset="55%" stopColor="#14296c" />
          <stop offset="100%" stopColor="#0a163f" />
        </radialGradient>
        <linearGradient id={`${id}ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7b46a" />
          <stop offset="50%" stopColor="#c9643a" />
          <stop offset="100%" stopColor="#f39a4a" />
        </linearGradient>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ece3d4" />
        </linearGradient>
        <radialGradient id={`${id}spark`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff4dc" />
          <stop offset="55%" stopColor="#f6a24a" />
          <stop offset="100%" stopColor="#d06a32" />
        </radialGradient>
        <filter id={`${id}blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46.5" fill={`url(#${id}bg)`} stroke={`url(#${id}ring)`} strokeWidth="3" />
      {/* Fita direita (por baixo) e fita esquerda por cima, com o corte navy entre as duas. */}
      <path d="M48 52 L71.5 28 Q78 24.5 78 31.5 V70 L67 76.5 V45.5 L55.5 58.5 Z" fill={`url(#${id}m)`} />
      <path d="M22 31 Q22 25.5 27 27 L57.5 53 L50.5 61.5 L33 45.5 V70.5 L22 76.5 Z" fill={`url(#${id}m)`} stroke="#0f2258" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M50 22.5 C51 28.5 53 30.5 58.5 31.5 C53 32.5 51 34.5 50 40.5 C49 34.5 47 32.5 41.5 31.5 C47 30.5 49 28.5 50 22.5 Z" fill="#f59e3b" opacity="0.7" filter={`url(#${id}blur)`} />
      <path d="M50 22.5 C51 28.5 53 30.5 58.5 31.5 C53 32.5 51 34.5 50 40.5 C49 34.5 47 32.5 41.5 31.5 C47 30.5 49 28.5 50 22.5 Z" fill={`url(#${id}spark)`} />
    </svg>
  );
}
