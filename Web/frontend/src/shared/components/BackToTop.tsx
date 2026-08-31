import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

const visibilityThreshold = 560;

/** A compact page-level control for returning to the top after a long scroll. */
export function BackToTop() {
  const { hash, pathname, search } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > visibilityThreshold);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  useEffect(() => {
    setVisible(window.scrollY > visibilityThreshold);
  }, [hash, pathname, search]);

  if (!visible) return null;

  return (
    <button
      className="back-to-top"
      type="button"
      aria-label="Retour en haut de la page"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
