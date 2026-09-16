import type { UserRole } from '../../core/auth/types.js';
import { HeaderSearch } from '../../features/notifications/HeaderSearch.js';
import { NotificationBell } from '../../features/notifications/NotificationBell.js';

export function PortalHeaderActions({ role: _role }: { role: UserRole }) {
  return (
    <div className="portal-header-tools">
      <HeaderSearch />
      <NotificationBell />
    </div>
  );
}
