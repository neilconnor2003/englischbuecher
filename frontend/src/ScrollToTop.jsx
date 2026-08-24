// frontend/src/ScrollToTop.jsx
import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType(); // 'PUSH' | 'REPLACE' | 'POP'

  useEffect(() => {
    // 'POP' = browser back/forward button (or programmatic history.go/back).
    // The browser already restores the scroll position it had saved for
    // that history entry on its own — we just need to not stomp on it.
    // 'PUSH'/'REPLACE' = a genuine new navigation (clicking a link, a
    // navigate() call) — those should still start at the top, as before.
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;