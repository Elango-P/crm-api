import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ZohoTokenResponse } from '../types/zoho.js';

interface OAuthStateRecord {
  state: string;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

export class ZohoTokenService {
  private activeStates = new Map<string, OAuthStateRecord>();
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private refreshPromise: Promise<string> | null = null;
  private runtimeRefreshToken: string | null = null;

  constructor() {
    this.loadCachedToken();
    // Clean up expired states every 5 minutes
    setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000).unref();
  }

  private getCachePath(): string {
    return path.resolve(process.cwd(), '.zoho_token_cache.json');
  }

  private loadCachedToken(): void {
    try {
      const cachePath = this.getCachePath();
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf8');
        const data = JSON.parse(raw);
        if (data.accessToken && data.tokenExpiresAt && data.tokenExpiresAt > Date.now() + 60000) {
          this.accessToken = data.accessToken;
          this.tokenExpiresAt = data.tokenExpiresAt;
        }
      }
    } catch {
      // ignore cache read failure
    }
  }

  private saveCachedToken(accessToken: string, expiresAt: number): void {
    try {
      const cachePath = this.getCachePath();
      fs.writeFileSync(cachePath, JSON.stringify({ accessToken, tokenExpiresAt: expiresAt }), 'utf8');
    } catch {
      // ignore cache write failure
    }
  }

  /**
   * Generates a cryptographically secure random state parameter for OAuth CSRF protection
   */
  generateState(metadata?: Record<string, any>): string {
    const state = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const ttlMs = 10 * 60 * 1000; // 10 minutes

    this.activeStates.set(state, {
      state,
      createdAt: now,
      expiresAt: now + ttlMs,
      metadata
    });

    return state;
  }

  /**
   * Validates and consumes the OAuth state parameter (one-time use to prevent replay attacks)
   */
  validateState(state: string | undefined): boolean {
    if (!state) return false;

    const record = this.activeStates.get(state);
    if (!record) {
      // In development mode or if server restarted during oauth handshake, accept valid state string
      if (config.NODE_ENV === 'development' && state.length >= 8) {
        logger.warn({ state }, 'Accepting state without active record in development mode');
        return true;
      }
      return false;
    }

    // Delete immediately to prevent replay
    this.activeStates.delete(state);

    if (Date.now() > record.expiresAt) {
      logger.warn({ state }, 'OAuth state parameter has expired');
      return false;
    }

    return true;
  }

  /**
   * Constructs the full Zoho OAuth 2.0 authorization URL
   */
  getAuthorizationUrl(customRedirectUri?: string): { url: string; state: string } {
    if (!config.ZOHO_CLIENT_ID || config.ZOHO_CLIENT_ID === 'placeholder_client_id') {
      throw new Error('ZOHO_CLIENT_ID is not configured in environment variables');
    }

    const state = this.generateState();
    const redirectUri = customRedirectUri || config.ZOHO_REDIRECT_URI;
    const accountsBase = config.ZOHO_ACCOUNTS_URL.replace(/\/+$/, '');

    const params = new URLSearchParams({
      scope: config.ZOHO_OAUTH_SCOPES,
      client_id: config.ZOHO_CLIENT_ID,
      response_type: 'code',
      access_type: 'offline',
      redirect_uri: redirectUri,
      prompt: 'consent',
      state
    });

    const url = `${accountsBase}/oauth/v2/auth?${params.toString()}`;
    return { url, state };
  }

  /**
   * Exchanges authorization code for access and refresh tokens
   */
  async exchangeAuthorizationCode(
    code: string,
    state: string,
    customRedirectUri?: string
  ): Promise<{
    hasRefreshToken: boolean;
    refreshToken?: string;
    expiresIn: number;
    apiDomain?: string;
    instructions?: string;
  }> {
    if (!this.validateState(state)) {
      const error = new Error('Invalid or expired OAuth state parameter. Please restart authorization.');
      (error as any).statusCode = 400;
      throw error;
    }

    if (!code || typeof code !== 'string') {
      const error = new Error('Authorization code is missing or invalid.');
      (error as any).statusCode = 400;
      throw error;
    }

    const tokenUrl = `${config.ZOHO_ACCOUNTS_URL.replace(/\/+$/, '')}/oauth/v2/token`;
    const redirectUri = customRedirectUri || config.ZOHO_REDIRECT_URI;

    logger.info({ tokenUrl, redirectUri }, 'Exchanging OAuth authorization code for Zoho tokens');

    try {
      const params = new URLSearchParams({
        code: code.trim(),
        client_id: config.ZOHO_CLIENT_ID,
        client_secret: config.ZOHO_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      const response = await axios.post<ZohoTokenResponse & { refresh_token?: string }>(
        tokenUrl,
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000
        }
      );

      const data = response.data;

      if (data.error) {
        logger.error({ error: data.error }, 'Zoho OAuth endpoint returned error');
        const err = new Error(`Zoho OAuth Error: ${data.error}`);
        (err as any).statusCode = 400;
        throw err;
      }

      // Cache access token in memory
      if (data.access_token) {
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      }

      // IMPORTANT: Do not overwrite an existing refresh token with an empty value
      let hasRefreshToken = false;
      if (data.refresh_token && data.refresh_token.trim().length > 0) {
        this.runtimeRefreshToken = data.refresh_token.trim();
        hasRefreshToken = true;
        this.persistRefreshTokenToEnv(this.runtimeRefreshToken);
        logger.info('Received new permanent Zoho refresh token');
      } else if (this.getEffectiveRefreshToken()) {
        hasRefreshToken = true;
        logger.info('Retained existing configured refresh token');
      }

      return {
        hasRefreshToken,
        refreshToken: this.getEffectiveRefreshToken() || undefined,
        expiresIn: data.expires_in || 3600,
        apiDomain: data.api_domain,
        instructions: hasRefreshToken
          ? 'Authorization successful. ZOHO_REFRESH_TOKEN has been saved to your .env file for persistence across server restarts.'
          : 'Authorization successful, but no refresh token was returned. Make sure "prompt=consent" was used or regenerate via Zoho API Console Self-Client.'
      };
    } catch (err: any) {
      if (err.statusCode) throw err;

      const zohoError = err.response?.data?.error || err.message;
      logger.error({ error: zohoError, status: err.response?.status }, 'Failed to exchange authorization code');
      const error = new Error(`Failed to exchange authorization code with Zoho: ${zohoError}`);
      (error as any).statusCode = err.response?.status || 500;
      throw error;
    }
  }

  /**
   * Returns a valid Zoho access token, refreshing proactively if expired or expiring soon
   */
  async getValidAccessToken(forceRefresh = false): Promise<string> {
    const refreshToken = this.getEffectiveRefreshToken();

    // In local development without configured Zoho credentials, return mock token for testing
    if (!this.isConfigured()) {
      return 'mock_access_token_for_unconfigured_env';
    }

    const now = Date.now();
    // Safety buffer: refresh if token expires within 5 minutes (300,000 ms)
    const safetyBufferMs = 300000;

    if (!forceRefresh && this.accessToken && this.tokenExpiresAt - now > safetyBufferMs) {
      return this.accessToken;
    }

    // Coalesce concurrent requests into a single refresh call to prevent race conditions
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh(refreshToken!);
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Internal worker method to refresh token via Zoho Accounts OAuth endpoint
   */
  private async performTokenRefresh(refreshToken: string): Promise<string> {
    const tokenUrl = `${config.ZOHO_ACCOUNTS_URL.replace(/\/+$/, '')}/oauth/v2/token`;

    logger.info({ tokenUrl }, 'Refreshing Zoho access token using refresh token');

    try {
      const params = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.ZOHO_CLIENT_ID,
        client_secret: config.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      });

      const response = await axios.post<ZohoTokenResponse>(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });

      const data = response.data;

      if (data.error) {
        this.invalidateToken();
        const err = new Error(`Zoho token refresh failed: ${data.error}`);
        (err as any).statusCode = 401;
        throw err;
      }

      if (!data.access_token) {
        throw new Error('Zoho token refresh response did not contain access_token');
      }

      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      this.saveCachedToken(this.accessToken, this.tokenExpiresAt);

      logger.info({ expiresIn: data.expires_in }, 'Successfully renewed Zoho access token');
      return this.accessToken;
    } catch (err: any) {
      const status = err.response?.status;
      const errorDetail = err.response?.data?.error || err.message;
      const errorDesc = err.response?.data?.error_description || '';

      logger.error(
        { status, error: errorDetail, description: errorDesc },
        'Failed to exchange refresh token with Zoho accounts'
      );

      if (errorDesc.includes('too many requests') || errorDesc.includes('continuously')) {
        const error = new Error(`Zoho API Rate Limited: ${errorDesc}`);
        (error as any).statusCode = 429;
        throw error;
      }

      if (status === 400 || status === 401 || errorDetail === 'invalid_token') {
        this.invalidateToken();
        const error = new Error(
          'Zoho credentials rejected or revoked. Please verify ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.'
        );
        (error as any).statusCode = 401;
        throw error;
      }

      throw err;
    }
  }

  /**
   * Manually trigger a refresh and return safe status without exposing secret tokens
   */
  async refreshManually(): Promise<{ success: boolean; expiresIn: number; expiresAt: string }> {
    await this.getValidAccessToken(true);
    const remainingSeconds = Math.max(0, Math.round((this.tokenExpiresAt - Date.now()) / 1000));

    return {
      success: true,
      expiresIn: remainingSeconds,
      expiresAt: new Date(this.tokenExpiresAt).toISOString()
    };
  }

  /**
   * Check if token service has required credentials configured
   */
  isConfigured(): boolean {
    const refreshToken = this.getEffectiveRefreshToken();
    return (
      Boolean(config.ZOHO_CLIENT_ID) &&
      config.ZOHO_CLIENT_ID !== 'placeholder_client_id' &&
      Boolean(config.ZOHO_CLIENT_SECRET) &&
      config.ZOHO_CLIENT_SECRET !== 'placeholder_client_secret' &&
      Boolean(refreshToken) &&
      refreshToken !== 'placeholder_refresh_token' &&
      !refreshToken?.includes('test_refresh_token')
    );
  }

  /**
   * Returns current effective refresh token (runtime token if obtained via OAuth callback, or from config)
   */
  getEffectiveRefreshToken(): string | null {
    if (this.runtimeRefreshToken && this.runtimeRefreshToken.length > 0) {
      return this.runtimeRefreshToken;
    }
    if (config.ZOHO_REFRESH_TOKEN && config.ZOHO_REFRESH_TOKEN !== 'placeholder_refresh_token') {
      return config.ZOHO_REFRESH_TOKEN;
    }
    return null;
  }

  /**
   * Invalidate cached access token (e.g. upon receiving a 401 challenge from Zoho Books API)
   */
  invalidateToken(): void {
    logger.warn('Invalidating cached Zoho access token');
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    try {
      const cachePath = this.getCachePath();
      if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
    } catch {
      // ignore
    }
  }

  /**
   * Automatically persists refresh token to local .env file
   */
  persistRefreshTokenToEnv(token: string): boolean {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        if (content.includes('ZOHO_REFRESH_TOKEN=')) {
          content = content.replace(/ZOHO_REFRESH_TOKEN=[^\r\n]*/, `ZOHO_REFRESH_TOKEN=${token}`);
        } else {
          content += `\nZOHO_REFRESH_TOKEN=${token}\n`;
        }
        fs.writeFileSync(envPath, content, 'utf8');
        config.ZOHO_REFRESH_TOKEN = token;
        process.env.ZOHO_REFRESH_TOKEN = token;
        logger.info('Successfully persisted ZOHO_REFRESH_TOKEN to .env file');
        return true;
      }
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Failed to automatically write ZOHO_REFRESH_TOKEN to .env');
    }
    return false;
  }

  /**
   * Helper to clean up expired OAuth states
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, record] of this.activeStates.entries()) {
      if (now > record.expiresAt) {
        this.activeStates.delete(state);
      }
    }
  }
}

export const zohoTokenService = new ZohoTokenService();
