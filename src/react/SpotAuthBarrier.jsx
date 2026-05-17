import { useEffect } from 'react';
import { useSpotAuth } from './SpotAuthContext.jsx';

/**
 * Auth gate component. Renders children only when authenticated.
 * Automatically triggers the Spotify auth flow if no valid token exists.
 *
 * @param {React.ReactNode} children - Content to render when authenticated
 * @param {React.ReactNode} fallback - Content to render while unauthenticated (default: null)
 */
export function SpotAuthBarrier({ children, fallback = null }) {
  const { isAuthenticated, triggerAuth } = useSpotAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      triggerAuth();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return fallback;
  return children;
}
