import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import chevronDownIcon from 'lucide-static/icons/chevron-down.svg';
import layoutDashboardIcon from 'lucide-static/icons/layout-dashboard.svg';
import logOutIcon from 'lucide-static/icons/log-out.svg';
import userRoundIcon from 'lucide-static/icons/user-round.svg';

import { roleHomePath } from '../../app/routes/destinations.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Avatar } from './Avatar.js';
import { Icon } from './Icon.js';

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  if (!user) return null;
  const name =
    [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ') ||
    user.email;
  return (
    <div className="user-menu" ref={root}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar user={user} size="small" />
        <span>{name}</span>
        <Icon src={chevronDownIcon} size={16} />
      </button>
      {open && (
        <div className="user-menu-popover" role="menu">
          <Link
            role="menuitem"
            to="/app/profile"
            onClick={() => setOpen(false)}
          >
            <Icon src={userRoundIcon} size={17} /> Mon profil
          </Link>
          <Link
            role="menuitem"
            to={roleHomePath(user.role)}
            onClick={() => setOpen(false)}
          >
            <Icon src={layoutDashboardIcon} size={17} /> Tableau de bord
          </Link>
          <button role="menuitem" type="button" onClick={() => void logout()}>
            <Icon src={logOutIcon} size={17} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
