import { Link } from 'react-router';

export function Brand({
  to = '/',
  className = 'site-brand',
  onClick,
}: {
  to?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      className={`brand ${className}`}
      to={to}
      onClick={onClick}
      aria-label="Accueil High Skills Academy"
    >
      <span className="brand-mark" aria-hidden="true">
        <span>HS</span>
      </span>
      <strong>High Skills Academy</strong>
    </Link>
  );
}
