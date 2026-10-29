import { zohoTokenService } from '../../services/zohoTokenService.js';

export class ZohoTokenManager {
  /**
   * Returns a valid Zoho access token, delegating to unified zohoTokenService
   */
  async getValidAccessToken(forceRefresh = false): Promise<string> {
    return zohoTokenService.getValidAccessToken(forceRefresh);
  }

  /**
   * Invalidate the in-memory token (e.g. upon receiving a 401 response from Zoho API)
   */
  invalidateToken(): void {
    zohoTokenService.invalidateToken();
  }

  /**
   * Check if token manager has credentials configured
   */
  isConfigured(): boolean {
    return zohoTokenService.isConfigured();
  }
}

export const zohoTokenManager = new ZohoTokenManager();
