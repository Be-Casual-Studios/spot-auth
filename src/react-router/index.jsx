import { useNavigate } from 'react-router-dom';
import { SpotAuthCallbackBase } from '../react/SpotAuthCallback.jsx';

/**
 * React Router-aware callback component.
 * Uses useNavigate() to redirect back after auth (preserves browser history).
 * Mount this on your /auth/callback route.
 *
 * Import from 'spot-auth/react-router' instead of 'spot-auth/react' to use this.
 */
export function SpotAuthCallback() {
  const navigate = useNavigate();
  return <SpotAuthCallbackBase onRedirect={(url) => navigate(url, { replace: true })} />;
}

// Re-export everything else from spot-auth/react unchanged
export { SpotAuthProvider, useSpotAuth } from '../react/SpotAuthContext.jsx';
export { SpotAuthBarrier } from '../react/SpotAuthBarrier.jsx';
export { SpotAuthCallbackBase } from '../react/SpotAuthCallback.jsx';
