import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { roleHomePath } from '../../app/routes/destinations.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Avatar } from './Avatar.js';

export function UserMenu({ compact = false }: { compact?: boolean }) {
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
        {!compact && <span>{name}</span>}
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="user-menu-popover" role="menu">
          <Link
            role="menuitem"
            to="/app/profile"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">◎</span> Mon profil
          </Link>
          <Link
            role="menuitem"
            to={roleHomePath(user.role)}
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">◇</span> Dashboard
          </Link>
          <button role="menuitem" type="button" onClick={() => void logout()}>
            <span aria-hidden="true">↪</span> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
