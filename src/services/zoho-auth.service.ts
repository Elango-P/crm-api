import { zohoTokenService, ZohoTokenService } from './zohoTokenService.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Service for managing Zoho ERP OAuth 2.0 authentication and tokens
 */
export class ZohoAuthService {
  constructor(private tokenService: ZohoTokenService = zohoTokenService) {}

  /**
   * Generates authorization URL with state parameter
   */
  getAuthorizationUrl(customRedirectUri?: string): { url: string; state: string } {
    return this.tokenService.getAuthorizationUrl(customRedirectUri);
  }

  /**
   * Generates a secure CSRF state
   */
  generateState(metadata?: Record<string, any>): string {
    return this.tokenService.generateState(metadata);
  }

  /**
   * Validates state parameter
   */
  validateState(state: string | undefined): boolean {
    return this.tokenService.validateState(state);
  }

  /**
   * Exchanges authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string, redirectUri?: string) {
    return this.tokenService.exchangeAuthorizationCode(code, state, redirectUri);
  }

  /**
   * Gets a valid access token, auto-refreshing if necessary
   */
  async getValidAccessToken(): Promise<string> {
    return this.tokenService.getValidAccessToken();
  }

  /**
   * Checks if Zoho OAuth credentials are configured
   */
  isConfigured(): boolean {
    return this.tokenService.isConfigured();
  }

  /**
   * Invalidates cached token to force re-fetch
   */
  invalidateToken(): void {
    this.tokenService.invalidateToken();
  }
}

export const zohoAuthService = new ZohoAuthService();
