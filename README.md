# spot-auth

Zero-friction Spotify OAuth for Node.js scripts and web apps.

- **Scripts** — one call to `getAccessToken()`, browser opens automatically, token cached to disk
- **React** — wrap your app in `<SpotAuthProvider>`, gate content with `<SpotAuthBarrier>`
- **Web Component** — `<spot-auth-barrier>` works in any framework or plain HTML
- **No backend required** — web flows use PKCE, no `client_secret` in the browser
- **Auto-refresh** — expired tokens are silently refreshed; concurrent calls are deduplicated

---

## Installation

```bash
npm install spot-auth
```

---

## Spotify Developer Setup

1. Go to [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app
2. Add your redirect URIs under **Edit Settings**:
   - Scripts: `http://127.0.0.1:3000/callback`
   - Web apps: `https://yourdomain.com/auth/callback` (and `http://localhost:5173/auth/callback` for local dev)
3. Note your **Client ID** (and **Client Secret** for scripts only)

---

## Script / Node.js

```js
import { SpotAuth } from 'spot-auth/node';

const auth = new SpotAuth({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  scope: 'playlist-read-private user-library-read',
});

const token = await auth.getAccessToken();
// First run: browser opens automatically, you log in once
// Subsequent runs: token loaded from .spotify-tokens.json instantly
```

### Config options

| Option | Type | Default | Description |
|---|---|---|---|
| `clientId` | string | required | Spotify app Client ID |
| `clientSecret` | string | required | Spotify app Client Secret |
| `scope` | string | required | Space-separated Spotify scopes |
| `redirectUri` | string | `http://127.0.0.1:3000/callback` | Must match Spotify dashboard |
| `tokenCachePath` | string | `process.cwd()/.spotify-tokens.json` | Override token cache location |

### How it works

1. On first call, opens your browser to Spotify login and starts a temporary local server to capture the callback
2. Exchanges the code for tokens and caches them to `.spotify-tokens.json` (auto-added to `.gitignore`)
3. On subsequent calls, loads the cached token — if expired, silently refreshes using the stored refresh token
4. Multiple concurrent calls to `getAccessToken()` share a single in-flight request

---

## React

### 1. Wrap your app with `SpotAuthProvider`

```jsx
// main.jsx
import { SpotAuthProvider } from 'spot-auth/react';

createRoot(document.getElementById('root')).render(
  <SpotAuthProvider
    clientId={import.meta.env.VITE_SPOTIFY_CLIENT_ID}
    scope="playlist-read-private user-library-read"
    redirectUri={`${window.location.origin}/auth/callback`}
  >
    <App />
  </SpotAuthProvider>
);
```

### 2. Mount `SpotAuthCallback` on your callback route

```jsx
// Router-agnostic — renders on the /auth/callback page
import { SpotAuthCallback } from 'spot-auth/react';
<SpotAuthCallback />
```

```jsx
// React Router
import { SpotAuthCallback } from 'spot-auth/react-router';
<Route path="/auth/callback" element={<SpotAuthCallback />} />
```

### 3. Gate content with `SpotAuthBarrier`

```jsx
import { SpotAuthBarrier } from 'spot-auth/react';

<SpotAuthBarrier fallback={<div>Loading...</div>}>
  <MySpotifyPage />
</SpotAuthBarrier>
```

Users who aren't authenticated are redirected to Spotify login automatically. After login they're returned to the page they were on.

### 4. Access the token anywhere

```jsx
import { useSpotAuth } from 'spot-auth/react';

function MyComponent() {
  const { accessToken, isAuthenticated, logout } = useSpotAuth();

  const fetchProfile = async () => {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return res.json();
  };

  return (
    <div>
      {isAuthenticated && <button onClick={logout}>Log out</button>}
    </div>
  );
}
```

### `SpotAuthProvider` props

| Prop | Type | Description |
|---|---|---|
| `clientId` | string | Spotify app Client ID |
| `scope` | string | Space-separated Spotify scopes |
| `redirectUri` | string | Must match Spotify dashboard and your callback route |

### `SpotAuthBarrier` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | ReactNode | required | Content to render when authenticated |
| `fallback` | ReactNode | `null` | Content to render while unauthenticated |

---

## Web Component

Works in any framework or plain HTML. No build step required.

```html
<script type="module" src="/node_modules/spot-auth/webcomponent/spot-auth-barrier.js"></script>

<spot-auth-barrier
  client-id="your_client_id"
  scope="playlist-read-private user-library-read"
  redirect-uri="https://yourapp.com/auth/callback"
>
  <div>This content is hidden until the user is authenticated.</div>
</spot-auth-barrier>
```

The component handles both the initial auth redirect and the callback detection automatically — no separate callback page needed.

### Accessing the token

**Option 1 — `getSpotToken()` helper** (use anywhere after the barrier is in the DOM):

```js
import { getSpotToken } from '/node_modules/spot-auth/webcomponent/spot-auth-barrier.js';

// Always returns a valid token — silently refreshes if expired,
// triggers full auth redirect if no token exists at all.
const token = await getSpotToken();

const res = await fetch('https://api.spotify.com/v1/me', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**Option 2 — `spot-auth-ready` event** (fired by the component when auth is confirmed):

```js
document.querySelector('spot-auth-barrier')
  .addEventListener('spot-auth-ready', (event) => {
    const { accessToken } = event.detail;
    // safe to make Spotify API calls now
  });
```

The event fires on every page load where a valid token exists (including after a silent refresh), not just the first time.

### Attributes

| Attribute | Description |
|---|---|
| `client-id` | Spotify app Client ID |
| `scope` | Space-separated Spotify scopes |
| `redirect-uri` | Must match Spotify dashboard |

---

## How PKCE Works (Web / Browser)

The browser and web component flows use PKCE (Proof Key for Code Exchange), which lets you authenticate without a `client_secret`:

1. A random `code_verifier` is generated in the browser
2. Its SHA-256 hash (`code_challenge`) is sent to Spotify during the auth redirect
3. After login, Spotify sends back an auth code
4. The browser exchanges the code + original verifier directly with Spotify — no backend needed
5. Spotify validates that the verifier matches the challenge it stored

Refresh tokens are **rotating** with PKCE — each refresh returns a new refresh token, which is saved automatically.

---

## localStorage / sessionStorage Keys

| Key | Storage | Contents |
|---|---|---|
| `spot_auth_tokens` | localStorage | `{ access_token, refresh_token, expires_at, created_at }` |
| `spot_auth_return_url` | localStorage | URL to redirect to after auth (cleared after use) |
| `spot_auth_verifier` | sessionStorage | PKCE code_verifier (cleared after use) |
| `spot_auth_state` | sessionStorage | OAuth state for CSRF protection (cleared after use) |
