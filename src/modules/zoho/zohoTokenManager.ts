import axios from 'axios';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { ZohoTokenResponse } from '../../types/zoho.js';

export class ZohoTokenManager {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private refreshPromise: Promise<string> | null = null;

  /**
   * Returns a valid Zoho access token, refreshing if necessary
   */
  async getValidAccessToken(forceRefresh = false): Promise<string> {
    if (!this.isConfigured()) {
      return 'mock_access_token_for_unconfigured_env';
    }

    const now = Date.now();
    // Safety buffer: refresh if token expires within 5 minutes (300,000 ms)
    const safetyBufferMs = 300000;

    if (!forceRefresh && this.accessToken && this.tokenExpiresAt - now > safetyBufferMs) {
      return this.accessToken;
    }

    // Coalesce concurrent requests into a single refresh call
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshToken();
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshToken(): Promise<string> {
    const tokenUrl = `${config.ZOHO_ACCOUNTS_URL.replace(/\/+$/, '')}/oauth/v2/token`;

    logger.info({ tokenUrl }, 'Refreshing Zoho OAuth 2.0 access token');

    try {
      const params = new URLSearchParams({
        refresh_token: config.ZOHO_REFRESH_TOKEN,
        client_id: config.ZOHO_CLIENT_ID,
        client_secret: config.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      });

      const response = await axios.post<ZohoTokenResponse>(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });

      const data = response.data;

      if (data.error || !data.access_token) {
        const errorMsg = data.error || 'Unknown token error from Zoho';
        logger.error({ error: errorMsg }, 'Zoho token refresh failed with API error');
        throw new Error(`Zoho OAuth token refresh failed: ${errorMsg}`);
      }

      this.accessToken = data.access_token;
      // expires_in is in seconds
      const expiresInMs = (data.expires_in || 3600) * 1000;
      this.tokenExpiresAt = Date.now() + expiresInMs;

      logger.info({ expiresIn: data.expires_in }, 'Zoho OAuth token refreshed successfully');

      return this.accessToken;
    } catch (error: any) {
      const status = error.response?.status;
      const responseData = error.response?.data;

      logger.error(
        {
          status,
          responseData: typeof responseData === 'object' ? responseData : undefined,
          errorMessage: error.message
        },
        'Failed to exchange refresh token with Zoho accounts'
      );

      if (status === 400 || status === 401) {
        throw new Error(
          'Zoho credentials rejected or revoked. Please verify ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.'
        );
      }

      throw error;
    }
  }

  /**
   * Invalidate the in-memory token (e.g. upon receiving a 401 response from Zoho API)
   */
  invalidateToken(): void {
    logger.warn('Invalidating cached Zoho access token');
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Check if token manager has credentials configured
   */
  isConfigured(): boolean {
    return (
      config.ZOHO_CLIENT_ID !== 'placeholder_client_id' &&
      config.ZOHO_CLIENT_SECRET !== 'placeholder_client_secret' &&
      config.ZOHO_REFRESH_TOKEN !== 'placeholder_refresh_token'
    );
  }
}

export const zohoTokenManager = new ZohoTokenManager();
