import { Link } from 'react-router';

import blueLogo from '../../assets/hsa-logo-blue.png';
import whiteLogo from '../../assets/hsa-logo-footer.png';

export function BrandLogo({
  className,
  onClick,
}: {
  className: string;
  onClick?: () => void;
}) {
  return (
    <Link
      className={className}
      to="/"
      aria-label="Accueil High Skills Academy"
      onClick={onClick}
    >
      <img className="brand-logo-light" src={blueLogo} alt="High Skills Academy" />
      <img className="brand-logo-dark" src={whiteLogo} alt="" aria-hidden="true" />
    </Link>
  );
}
