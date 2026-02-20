import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  onClick?: () => void;
  theme?: 'dark' | 'light';
  className?: string;
}

export function BackButton({ onClick, theme = 'dark', className }: BackButtonProps) {
  const navigate = useNavigate();

  const colorClass =
    theme === 'light'
      ? 'text-black/40 hover:text-black/80'
      : 'text-white/40 hover:text-white/80';

  return (
    <button
      onClick={onClick ?? (() => navigate(-1))}
      className={`absolute top-8 left-8 md:left-16 transition-colors duration-300 cursor-pointer z-30 ${colorClass} ${className ?? ''}`}
      style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '14px',
        letterSpacing: 'normal',
        background: 'none',
        border: 'none',
        padding: '8px',
      }}
    >
      &larr; back
    </button>
  );
}
