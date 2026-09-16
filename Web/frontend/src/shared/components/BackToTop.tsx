import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLocation } from 'react-router';

const visibilityThreshold = 560;

/** A compact page-level control for returning to the top after a long scroll. */
export function BackToTop() {
  const { hash, pathname, search } = useLocation();
  const [visible, setVisible] = useState(false);
  const sentinel = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!sentinel.current || typeof IntersectionObserver === 'undefined')
      return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry)
        setVisible(
          !entry.isIntersecting && entry.boundingClientRect.bottom <= 0,
        );
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Synchronize discrete visibility with the browser's restored route position.
    // oxlint-disable-next-line react/set-state-in-effect
    setVisible(window.scrollY > visibilityThreshold);
  }, [hash, pathname, search]);

  return (
    <>
      <span
        ref={sentinel}
        className="back-to-top-sentinel"
        aria-hidden="true"
      />
      {visible && (
        <button
          className="back-to-top"
          type="button"
          aria-label="Retour en haut de la page"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
                .matches
                ? 'instant'
                : 'smooth',
            })
          }
        >
          <ArrowUp aria-hidden="true" size={19} />
        </button>
      )}
    </>
  );
}
