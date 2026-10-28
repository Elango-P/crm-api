import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { config } from '../../src/config/index.js';

describe('API Endpoints Integration Tests', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('should return 200 OK with dependency health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('dependencies');
      expect(res.body.dependencies).toHaveProperty('firebase');
      expect(res.body.dependencies).toHaveProperty('zoho');
    });
  });

  describe('GET /api/v1/sync/status', () => {
    it('should reject request without authentication (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/sync/status');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should reject request with invalid API key (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/sync/status')
        .set('x-api-key', 'wrong-key-1234567890123456');
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Forbidden');
    });

    it('should succeed with valid x-api-key and return sync status', async () => {
      const res = await request(app)
        .get('/api/v1/sync/status')
        .set('x-api-key', config.ADMIN_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('stats');
      expect(res.body.data).toHaveProperty('checkpoints');
      expect(res.body.data).toHaveProperty('scheduler');
    });

    it('should succeed with Bearer Authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/sync/status')
        .set('Authorization', `Bearer ${config.ADMIN_API_KEY}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/sync/logs', () => {
    it('should return sync logs when authenticated', async () => {
      const res = await request(app)
        .get('/api/v1/sync/logs?limit=5')
        .set('x-api-key', config.ADMIN_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/sync/run', () => {
    it('should trigger manual synchronization and return results', async () => {
      const res = await request(app)
        .post('/api/v1/sync/run')
        .set('x-api-key', config.ADMIN_API_KEY)
        .send({ mode: 'INCREMENTAL' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('totalProcessed');
    });
  });

  describe('POST /api/v1/sync/retry-failed', () => {
    it('should trigger retry of failed records and return counts', async () => {
      const res = await request(app)
        .post('/api/v1/sync/retry-failed')
        .set('x-api-key', config.ADMIN_API_KEY)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('retriedCount');
    });
  });
});
