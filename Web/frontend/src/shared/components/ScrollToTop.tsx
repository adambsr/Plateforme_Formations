import { useEffect } from 'react';
import { useLocation } from 'react-router';

/** Reset the document scroll position whenever navigation changes the page. */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [hash, pathname, search]);

  return null;
}
