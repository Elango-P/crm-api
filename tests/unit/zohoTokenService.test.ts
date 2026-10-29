import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { zohoTokenService } from '../../src/services/zohoTokenService.js';
import { getDataCenterFromUrl, verifyScopeCoverage } from '../../src/config/zohoConfig.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('Zoho Token Service & Config Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OAuth State Generation and CSRF Protection', () => {
    it('should generate a secure random 64-character hex state', () => {
      const state1 = zohoTokenService.generateState();
      const state2 = zohoTokenService.generateState();

      expect(typeof state1).toBe('string');
      expect(state1.length).toBe(64);
      expect(state1).not.toBe(state2);
    });

    it('should validate and consume state once (preventing replay attacks)', () => {
      const state = zohoTokenService.generateState();

      // First validation succeeds
      const isValidFirst = zohoTokenService.validateState(state);
      expect(isValidFirst).toBe(true);

      // Second validation fails because state was consumed
      const isValidSecond = zohoTokenService.validateState(state);
      expect(isValidSecond).toBe(false);
    });

    it('should reject invalid or undefined states', () => {
      expect(zohoTokenService.validateState(undefined)).toBe(false);
      expect(zohoTokenService.validateState('fake_unregistered_state')).toBe(false);
    });
  });

  describe('Authorization URL Generation', () => {
    it('should include all required Zoho OAuth parameters', () => {
      const { url, state } = zohoTokenService.getAuthorizationUrl();

      expect(url).toContain('response_type=code');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('scope=');
    });
  });

  describe('Data Center & Scope Helpers', () => {
    it('should identify data center correctly from accounts URL', () => {
      expect(getDataCenterFromUrl('https://accounts.zoho.com')).toBe('US');
      expect(getDataCenterFromUrl('https://accounts.zoho.in')).toBe('IN');
      expect(getDataCenterFromUrl('https://accounts.zoho.eu')).toBe('EU');
      expect(getDataCenterFromUrl('https://accounts.zoho.com.au')).toBe('AU');
      expect(getDataCenterFromUrl('https://accounts.zoho.jp')).toBe('JP');
    });

    it('should verify scope coverage properly', () => {
      const coverage = verifyScopeCoverage(['ZohoBooks.contacts.READ']);
      expect(coverage.hasCoverage).toBe(true);
    });
  });

  describe('Token Refresh and Caching', () => {
    it('should coalesce concurrent calls into a single refresh request', async () => {
      mockedAxios.post.mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: {
                  access_token: '1000.coalesced_token',
                  expires_in: 3600
                }
              }),
            20
          )
        )
      );

      // Fire two concurrent calls
      const [token1, token2] = await Promise.all([
        zohoTokenService.getValidAccessToken(true),
        zohoTokenService.getValidAccessToken(true)
      ]);

      expect(token1).toBe(token2);
    });

    it('should handle invalid or revoked refresh token error gracefully', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { error: 'invalid_token' }
        }
      });

      // Temporary set a fake runtime refresh token to force attempt
      (zohoTokenService as any).runtimeRefreshToken = '1000.revoked_token';

      await expect(zohoTokenService.getValidAccessToken(true)).rejects.toThrow(/revoked|rejected/i);

      // Clean up
      (zohoTokenService as any).runtimeRefreshToken = null;
    });
  });
});
