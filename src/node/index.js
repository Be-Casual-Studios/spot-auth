import open from 'open';
import { SpotAuth } from '../core/SpotAuth.js';
import { FileTokenStore } from './FileTokenStore.js';
import { waitForCallback } from './LocalAuthServer.js';
import { ensureGitignored } from './gitignore.js';
import { buildAuthUrl, exchangeCode, refreshAccessToken, normalizeTokenData } from '../core/oauth.js';

class NodeSpotAuth extends SpotAuth {
  constructor(config) {
    super(config, new FileTokenStore(config.tokenCachePath));
  }

  async _authenticate() {
    const state = Math.random().toString(36).substring(7);
    const authUrl = buildAuthUrl({
      clientId: this.config.clientId,
      scope: this.config.scope,
      redirectUri: this.config.redirectUri,
      state,
      // No codeChallenge — node flow uses Authorization Code with client_secret
    });

    console.log('\n🔑 Spotify authentication required.');

    try {
      await open(authUrl);
      console.log('Browser opened. Waiting for authorization...\n');
    } catch {
      console.log('Could not open browser automatically. Please open this URL:\n');
      console.log(`  ${authUrl}\n`);
    }

    const { code } = await waitForCallback(this._getCallbackPort());

    const tokenResponse = await exchangeCode({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      code,
      redirectUri: this.config.redirectUri,
    });

    const tokenData = normalizeTokenData(tokenResponse);
    this.store.set(tokenData);
    ensureGitignored();

    console.log('✅ Spotify authentication successful.\n');
    return tokenData.access_token;
  }

  async _doRefresh(refreshToken, cachedTokenData) {
    const tokenResponse = await refreshAccessToken({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      refreshToken,
    });

    const tokenData = normalizeTokenData(tokenResponse, cachedTokenData?.refresh_token);
    this.store.set(tokenData);
    return tokenData.access_token;
  }

  _getCallbackPort() {
    try {
      return parseInt(new URL(this.config.redirectUri).port) || 3000;
    } catch {
      return 3000;
    }
  }
}

export { NodeSpotAuth as SpotAuth };
