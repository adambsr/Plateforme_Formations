import type { User } from '../../core/auth/types.js';

export function Avatar({
  user,
  imageUrl,
  size = 'medium',
}: {
  user: Pick<User, 'email' | 'profile'>;
  imageUrl?: string;
  size?: 'small' | 'medium' | 'large';
}) {
  const name = [user.profile.firstName, user.profile.lastName]
    .filter(Boolean)
    .join(' ');
  const initials = (name || user.email)
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : initials || '?'}
    </span>
  );
}
