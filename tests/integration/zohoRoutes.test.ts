import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import axios from 'axios';
import { createApp } from '../../src/app.js';
import { config } from '../../src/config/index.js';
import { zohoTokenService } from '../../src/services/zohoTokenService.js';
import { zohoBooksService } from '../../src/services/zohoBooksService.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('Zoho Books Integration Endpoints Tests', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    (zohoTokenService as any).runtimeRefreshToken = null;
    (zohoTokenService as any).accessToken = null;
    (zohoTokenService as any).tokenExpiresAt = 0;
  });

  describe('GET /api/zoho/auth', () => {
    it('should generate authorization URL with correct OAuth parameters and redirect by default', async () => {
      const res = await request(app).get('/api/zoho/auth');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(config.ZOHO_ACCOUNTS_URL);
      expect(res.headers.location).toContain('client_id=');
      expect(res.headers.location).toContain('response_type=code');
      expect(res.headers.location).toContain('access_type=offline');
      expect(res.headers.location).toContain('prompt=consent');
      expect(res.headers.location).toContain('state=');
    });

    it('should return JSON with authorizationUrl and state when format=json query parameter is passed', async () => {
      const res = await request(app).get('/api/zoho/auth?format=json');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('authorizationUrl');
      expect(res.body).toHaveProperty('state');
      expect(typeof res.body.state).toBe('string');
      expect(res.body.state.length).toBeGreaterThan(16);
    });
  });

  describe('GET /api/zoho/callback', () => {
    it('should handle access_denied error gracefully', async () => {
      const res = await request(app).get('/api/zoho/callback?error=access_denied&error_description=User+declined');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'AccessDenied');
    });

    it('should reject callback if code is missing', async () => {
      const res = await request(app).get('/api/zoho/callback?state=xyz123');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'BadRequest');
    });

    it('should reject callback if state is invalid or expired (CSRF protection)', async () => {
      const res = await request(app).get('/api/zoho/callback?code=1000.grantcode&state=nonexistent_state');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('OAuth state');
    });

    it('should successfully exchange authorization code when valid state is provided', async () => {
      // 1. Generate valid state
      const state = zohoTokenService.generateState();

      // Mock axios token exchange response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: '1000.test_access_token_123',
          refresh_token: '1000.test_refresh_token_456',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.com',
          token_type: 'Bearer'
        }
      });

      const res = await request(app).get(`/api/zoho/callback?code=1000.validcode&state=${state}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('hasRefreshToken', true);
      expect(res.body).toHaveProperty('expiresIn', 3600);

      // SECURITY: Confirm tokens and secrets are NEVER exposed in response body
      expect(res.body).not.toHaveProperty('access_token');
      expect(res.body).not.toHaveProperty('refresh_token');
      expect(res.body).not.toHaveProperty('client_secret');
    });
  });

  describe('POST /api/zoho/token/refresh', () => {
    it('should reject unauthenticated request (401)', async () => {
      const res = await request(app).post('/api/zoho/token/refresh');
      expect(res.status).toBe(401);
    });

    it('should refresh token when authenticated and return safe expiry info', async () => {
      // Mock refresh response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: '1000.new_refreshed_access_token',
          expires_in: 3600,
          token_type: 'Bearer'
        }
      });

      const res = await request(app)
        .post('/api/zoho/token/refresh')
        .set('x-api-key', config.ADMIN_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('expiresInSeconds');
      expect(res.body.data).toHaveProperty('expiresAt');

      // SECURITY: Token is NOT in the response
      expect(res.body.data).not.toHaveProperty('access_token');
    });
  });

  describe('GET /api/zoho/config', () => {
    it('should return sanitized config status without exposing secrets', async () => {
      const res = await request(app).get('/api/zoho/config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('product');
      expect(res.body.data).toHaveProperty('clientSecretConfigured');
      expect(res.body.data).toHaveProperty('refreshTokenConfigured');
      expect(res.body.data).toHaveProperty('dataCenter');

      // Sensitive values are masked or boolean
      expect(res.body.data).not.toHaveProperty('client_secret');
      expect(res.body.data).not.toHaveProperty('refresh_token');
    });
  });

  describe('GET /api/zoho/organization', () => {
    it('should return organization information', async () => {
      const res = await request(app).get('/api/zoho/organization');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/zoho/contacts', () => {
    it('should list contacts with pagination', async () => {
      const res = await request(app).get('/api/zoho/contacts?page=1&per_page=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('contacts');
      expect(Array.isArray(res.body.data.contacts)).toBe(true);
    });
  });

  describe('GET /api/zoho/contacts/:contactId', () => {
    it('should return a contact by ID', async () => {
      const res = await request(app).get('/api/zoho/contacts/mock_contact_101');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('contact');
    });
  });

  describe('POST /api/zoho/contacts', () => {
    it('should fail with 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/zoho/contacts')
        .send({ email: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Error');
    });

    it('should create contact successfully with valid input', async () => {
      const payload = {
        contact_name: 'Starlight Dynamics',
        company_name: 'Starlight Dynamics Pvt Ltd',
        email: 'contact@starlightdynamics.com',
        phone: '+91 9988776655'
      };

      const res = await request(app)
        .post('/api/zoho/contacts')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.contact_name).toBe('Starlight Dynamics');
    });
  });

  describe('PUT /api/zoho/contacts/:contactId', () => {
    it('should update contact successfully', async () => {
      const res = await request(app)
        .put('/api/zoho/contacts/mock_contact_101')
        .send({ phone: '+91 9123456789' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
